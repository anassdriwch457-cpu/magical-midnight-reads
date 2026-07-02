import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  scrapeMangagoSeries,
  scrapeMangagoChapterImages,
  downloadImage,
  type ScrapedSeries,
} from "./scrapers/mangago";
import { assertStaff, extFromContentType, uploadToStorage } from "@/server/shared";

/* ============================== HELPERS ============================== */

async function appendLog(jobId: string, line: string) {
  const { data: row } = await supabaseAdmin
    .from("import_jobs")
    .select("logs")
    .eq("id", jobId)
    .maybeSingle();
  const logs = [...((row?.logs as string[]) ?? []), `${new Date().toISOString()} ${line}`].slice(
    -200,
  );
  await supabaseAdmin.from("import_jobs").update({ logs }).eq("id", jobId);
}

type JobPatch = Partial<{
  status: string;
  current_chapter: string | null;
  error: string | null;
  series_id: string | null;
  total_chapters: number;
  completed_chapters: number;
}>;

async function setJob(jobId: string, patch: JobPatch) {
  await supabaseAdmin.from("import_jobs").update(patch).eq("id", jobId);
}

/* ============================== CREATE JOB ============================== */

const CreateSchema = z.object({
  sourceUrl: z.string().url().max(500),
  sourceSite: z.enum(["mangago"]),
});

export const createImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);

    const { data: row, error } = await supabaseAdmin
      .from("import_jobs")
      .insert({
        source_url: data.sourceUrl,
        source_site: data.sourceSite,
        status: "pending",
        created_by: context.userId,
        logs: [`${new Date().toISOString()} Job created for ${data.sourceUrl}`],
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { jobId: row.id };
  });

/* ============================== LIST / GET ============================== */

export const listImportJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const { data, error } = await supabaseAdmin
      .from("import_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { jobs: data ?? [] };
  });

export const getImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const { data: job, error } = await supabaseAdmin
      .from("import_jobs")
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Job not found");
    return { job };
  });

/* ============================== STEP RUNNER ============================== */

/**
 * Performs ONE unit of work for the job, returns updated state.
 * The client polls this until status is `done` or `failed`.
 *
 * Stages:
 *  - pending   → scrape series, upload cover, create series row + chapter rows → status=importing_chapters
 *  - importing_chapters → process the next chapter that has 0 pages → import all its images
 *  - all chapters done → status=done
 */
export const runImportStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);

    const { data: job, error: jErr } = await supabaseAdmin
      .from("import_jobs")
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (jErr) throw new Error(jErr.message);
    if (!job) throw new Error("Job not found");
    if (job.status === "done" || job.status === "failed") {
      return { job };
    }

    try {
      /* -------- STAGE 1: scrape series + chapter list -------- */
      if (job.status === "pending" || job.status === "scraping") {
        await setJob(job.id, { status: "scraping", current_chapter: "Fetching series page…" });
        await appendLog(job.id, `Scraping series ${job.source_url}`);

        let scraped: ScrapedSeries;
        if (job.source_site === "mangago") {
          scraped = await scrapeMangagoSeries(job.source_url);
        } else {
          throw new Error(`Unsupported source site: ${job.source_site}`);
        }

        await appendLog(
          job.id,
          `Found "${scraped.title}" with ${scraped.chapters.length} chapters`,
        );

        // Dedupe: if a series with this source_url already exists, reuse it.
        const { data: existing } = await supabaseAdmin
          .from("series")
          .select("id")
          .eq("source_url", scraped.sourceUrl)
          .maybeSingle();

        let seriesId: string;
        if (existing) {
          seriesId = existing.id;
          await appendLog(job.id, `Reusing existing series row ${seriesId}`);
        } else {
          // Upload cover
          let coverPublicUrl: string | null = null;
          if (scraped.coverUrl) {
            try {
              const { bytes, contentType } = await downloadImage(
                scraped.coverUrl,
                job.source_url,
              );
              const ext = extFromContentType(contentType);
              coverPublicUrl = await uploadToStorage(
                `import/${scraped.slug}/cover.${ext}`,
                bytes,
                contentType,
              );
            } catch (err) {
              await appendLog(
                job.id,
                `Cover download failed: ${(err as Error).message} (continuing)`,
              );
            }
          }

          // Make slug unique
          let slug = scraped.slug;
          for (let i = 2; i < 50; i++) {
            const { data: clash } = await supabaseAdmin
              .from("series")
              .select("id")
              .eq("slug", slug)
              .maybeSingle();
            if (!clash) break;
            slug = `${scraped.slug}-${i}`;
          }

          const { data: created, error: cErr } = await supabaseAdmin
            .from("series")
            .insert({
              title: scraped.title,
              slug,
              description: scraped.description || null,
              cover_url: coverPublicUrl,
              status: scraped.status,
              type: "manga",
              author: scraped.author,
              genres: scraped.genres,
              source_url: scraped.sourceUrl,
            })
            .select("id")
            .single();
          if (cErr) throw new Error(`Create series failed: ${cErr.message}`);
          seriesId = created.id;
          await appendLog(job.id, `Created series ${seriesId} (slug: ${slug})`);
        }

        // Insert any missing chapter rows (no pages yet).
        for (const ch of scraped.chapters) {
          const { data: existingCh } = await supabaseAdmin
            .from("chapters")
            .select("id")
            .eq("series_id", seriesId)
            .eq("number", ch.number)
            .maybeSingle();
          if (!existingCh) {
            await supabaseAdmin.from("chapters").insert({
              series_id: seriesId,
              number: ch.number,
              title: ch.title,
              price: 0,
              source_url: ch.sourceUrl,
            });
          } else if (ch.sourceUrl) {
            await supabaseAdmin
              .from("chapters")
              .update({ source_url: ch.sourceUrl })
              .eq("id", existingCh.id);
          }
        }

        await setJob(job.id, {
          series_id: seriesId,
          status: "importing_chapters",
          total_chapters: scraped.chapters.length,
          completed_chapters: 0,
          current_chapter: "Ready to import chapters",
        });
        await appendLog(job.id, `Series ready. Importing ${scraped.chapters.length} chapters…`);

        const { data: refreshed } = await supabaseAdmin
          .from("import_jobs")
          .select("*")
          .eq("id", job.id)
          .single();
        return { job: refreshed };
      }

      /* -------- STAGE 2: import the next chapter that has no pages -------- */
      if (job.status === "importing_chapters") {
        if (!job.series_id) throw new Error("Job missing series_id");

        // Find next chapter with a source_url and no pages.
        const { data: chapters } = await supabaseAdmin
          .from("chapters")
          .select("id, number, title, source_url")
          .eq("series_id", job.series_id)
          .not("source_url", "is", null)
          .order("number", { ascending: true });

        const all = chapters ?? [];
        let next: (typeof all)[number] | null = null;
        let completed = 0;
        for (const ch of all) {
          const { count } = await supabaseAdmin
            .from("chapter_pages")
            .select("id", { count: "exact", head: true })
            .eq("chapter_id", ch.id);
          if ((count ?? 0) === 0) {
            next = ch;
            break;
          }
          completed++;
        }

        if (!next) {
          await setJob(job.id, {
            status: "done",
            completed_chapters: all.length,
            current_chapter: null,
          });
          await appendLog(job.id, `All chapters imported. Job done.`);
          const { data: refreshed } = await supabaseAdmin
            .from("import_jobs")
            .select("*")
            .eq("id", job.id)
            .single();
          return { job: refreshed };
        }

        await setJob(job.id, {
          completed_chapters: completed,
          current_chapter: `Ch.${next.number}${next.title ? ` — ${next.title}` : ""}`,
        });
        await appendLog(job.id, `Importing Ch.${next.number} from ${next.source_url}`);

        // Scrape image URLs
        const imgs = await scrapeMangagoChapterImages(next.source_url!);
        await appendLog(job.id, `Found ${imgs.length} images for Ch.${next.number}`);

        // Download + upload each, insert chapter_pages
        let pageNum = 1;
        for (const url of imgs) {
          try {
            const { bytes, contentType } = await downloadImage(url, next.source_url!);
            const ext = extFromContentType(contentType);
            const slug = job.series_id.slice(0, 8);
            const path = `import/${slug}/ch-${next.number}/p-${String(pageNum).padStart(
              4,
              "0",
            )}.${ext}`;
            const publicUrl = await uploadToStorage(path, bytes, contentType);
            await supabaseAdmin.from("chapter_pages").insert({
              chapter_id: next.id,
              page_number: pageNum,
              image_url: publicUrl,
            });
            pageNum++;
          } catch (err) {
            await appendLog(
              job.id,
              `Page ${pageNum} failed for Ch.${next.number}: ${(err as Error).message}`,
            );
          }
        }

        await setJob(job.id, {
          completed_chapters: completed + 1,
        });
        await appendLog(
          job.id,
          `Ch.${next.number} done (${pageNum - 1}/${imgs.length} pages saved)`,
        );

        const { data: refreshed } = await supabaseAdmin
          .from("import_jobs")
          .select("*")
          .eq("id", job.id)
          .single();
        return { job: refreshed };
      }

      // Unknown state — mark failed
      throw new Error(`Unknown job status: ${job.status}`);
    } catch (err) {
      const msg = (err as Error).message || String(err);
      await appendLog(job.id, `ERROR: ${msg}`);
      await setJob(job.id, { status: "failed", error: msg });
      const { data: refreshed } = await supabaseAdmin
        .from("import_jobs")
        .select("*")
        .eq("id", job.id)
        .single();
      return { job: refreshed };
    }
  });

/* ============================== CANCEL / DELETE ============================== */

export const cancelImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    await setJob(data.jobId, { status: "failed", error: "Cancelled by user" });
    return { ok: true };
  });
