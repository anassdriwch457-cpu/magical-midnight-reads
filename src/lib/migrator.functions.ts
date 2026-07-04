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

/* ============================== AUTH ============================== */

async function assertStaff(userId: string) {
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const ok = (roles ?? []).some(
    (r) => r.role === "admin" || r.role === "super_admin" || r.role === "manager",
  );
  if (!ok) throw new Error("Insufficient privileges");
}

/* ============================== HELPERS ============================== */

const BUCKET = "chapter-images";

async function uploadBytes(path: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function downloadRemoteImage(url: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
}> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${url}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  if (contentType.startsWith("text/html")) {
    throw new Error(`Expected an image URL, got HTML instead: ${url}`);
  }
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    contentType,
  };
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
              const { bytes, contentType } = await downloadImage(scraped.coverUrl, job.source_url);
              const ext = extFromContentType(contentType);
              coverPublicUrl = await uploadBytes(
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
            const publicUrl = await uploadBytes(path, bytes, contentType);
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

const GenericChapterSchema = z.object({
  number: z.number().int().min(0).max(100000),
  title: z.string().max(255).nullable().optional(),
  price: z.number().min(0).max(100000).optional().default(0),
  imageUrls: z.array(z.string().url().max(2000)).min(1).max(500),
  sourceUrl: z.string().url().max(500).nullable().optional(),
});

const GenericSeriesImportSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
  author: z.string().max(255).nullable().optional(),
  slug: z.string().max(200).nullable().optional(),
  type: z.enum(["manga", "novel"]).optional().default("manga"),
  status: z.enum(["ongoing", "completed", "hiatus"]).optional().default("ongoing"),
  sourceUrl: z.string().url().max(500).nullable().optional(),
  genres: z.array(z.string().min(1).max(50)).max(20).optional().default([]),
  chapters: z.array(GenericChapterSchema).min(1).max(100).optional(),
  imageUrls: z.array(z.string().url().max(2000)).min(1).max(500).optional(),
});

type GenericSeriesImport = z.infer<typeof GenericSeriesImportSchema>;

const DEFAULT_SCRAPE_SERIES_ENDPOINT =
  "https://id-preview--d6aba0fd-2981-4469-af57-122483712b54.lovable.app/api/public/scrape-series";

const ScrapeSeriesRequestSchema = z.object({
  url: z.string().url().max(500),
  site: z.enum(["mangabuddy", "kunmanga", "comix"]),
  includeChapterImages: z.boolean().optional().default(false),
  chapterLimit: z.number().int().min(1).max(200).optional().default(50),
});

const ScrapeSeriesResponseSchema = z.object({
  ok: z.boolean().optional(),
  site: z.enum(["mangabuddy", "kunmanga", "comix"]),
  source_url: z.string().url().max(500).optional(),
  series: z.object({
    title: z.string().min(1).max(255),
    altNames: z.array(z.string().max(255)).optional().default([]),
    description: z.string().max(5000).nullable().optional(),
    coverUrl: z.string().url().max(2000).nullable().optional(),
    status: z.enum(["ongoing", "completed", "hiatus"]).optional(),
    genres: z.array(z.string().min(1).max(50)).optional().default([]),
    author: z.string().max(255).nullable().optional(),
    slug: z.string().max(200).optional(),
  }),
  chapter_count: z.number().int().min(0).optional(),
  chapters: z.array(
    z.object({
      number: z.number().int().min(0).max(100000),
      title: z.string().max(255).nullable().optional(),
      sourceUrl: z.string().url().max(500).nullable().optional(),
      images: z.array(z.string().url().max(2000)).optional().default([]),
    }),
  ),
});

async function importGenericSeries(data: GenericSeriesImport) {
  const chapterPayloads = data.chapters?.length
    ? data.chapters
    : data.imageUrls?.length
      ? [{ number: 1, title: null, price: 0, imageUrls: data.imageUrls }]
      : [];
  if (chapterPayloads.length === 0) {
    throw new Error("Provide chapters or imageUrls");
  }

  const baseSlug = slugify(data.slug?.trim() || data.title);
  let seriesId: string | null = null;
  let seriesSlug = baseSlug || "series";

  if (data.sourceUrl) {
    const { data: existing, error } = await supabaseAdmin
      .from("series")
      .select("id, slug")
      .eq("source_url", data.sourceUrl)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (existing) {
      seriesId = existing.id;
      seriesSlug = existing.slug;
      const { error: updateError } = await supabaseAdmin
        .from("series")
        .update({
          title: data.title,
          description: data.description ?? null,
          author: data.author ?? null,
          status: data.status,
          type: data.type,
          genres: data.genres,
          source_url: data.sourceUrl,
        })
        .eq("id", seriesId);
      if (updateError) throw new Error(`Update series failed: ${updateError.message}`);
    }
  }

  if (!seriesId) {
    let candidate = seriesSlug;
    for (let i = 2; ; i++) {
      const { data: clash, error } = await supabaseAdmin
        .from("series")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!clash) {
        seriesSlug = candidate;
        break;
      }
      candidate = `${baseSlug || "series"}-${i}`;
    }

    const { data: created, error } = await supabaseAdmin
      .from("series")
      .insert({
        title: data.title,
        slug: seriesSlug,
        description: data.description ?? null,
        author: data.author ?? null,
        status: data.status,
        type: data.type,
        genres: data.genres,
        source_url: data.sourceUrl ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Create series failed: ${error.message}`);
    seriesId = created.id;
  }

  if (!seriesId) {
    throw new Error("Failed to resolve series ID");
  }
  const resolvedSeriesId = seriesId;

  const chapters: Array<{
    chapterNumber: number;
    chapterId: string;
    savedPages: number;
    totalPages: number;
  }> = [];
  for (const chapter of chapterPayloads) {
    const { data: existingChapter, error: chapterLookupError } = await supabaseAdmin
      .from("chapters")
      .select("id")
      .eq("series_id", resolvedSeriesId)
      .eq("number", chapter.number)
      .maybeSingle();
    if (chapterLookupError) throw new Error(chapterLookupError.message);

    let chapterId: string;
    if (existingChapter) {
      chapterId = existingChapter.id;
      const { error: updateError } = await supabaseAdmin
        .from("chapters")
        .update({
          title: chapter.title ?? null,
          price: chapter.price ?? 0,
          source_url: chapter.sourceUrl ?? null,
        })
        .eq("id", chapterId);
      if (updateError) throw new Error(`Update chapter failed: ${updateError.message}`);
      const { error: deletePagesError } = await supabaseAdmin
        .from("chapter_pages")
        .delete()
        .eq("chapter_id", chapterId);
      if (deletePagesError) throw new Error(deletePagesError.message);
    } else {
      const { data: createdChapter, error: createChapterError } = await supabaseAdmin
        .from("chapters")
        .insert({
          series_id: resolvedSeriesId,
          number: chapter.number,
          title: chapter.title ?? null,
          price: chapter.price ?? 0,
          source_url: chapter.sourceUrl ?? null,
        })
        .select("id")
        .single();
      if (createChapterError) {
        throw new Error(`Create chapter failed: ${createChapterError.message}`);
      }
      chapterId = createdChapter.id;
    }

    let savedPages = 0;
    let pageNumber = 1;
    for (const rawUrl of chapter.imageUrls) {
      const url = rawUrl.trim();
      if (!url) {
        pageNumber++;
        continue;
      }
      try {
        const { bytes, contentType } = await downloadRemoteImage(url);
        const ext = extFromContentType(contentType);
        const path = `import/${seriesSlug}/ch-${chapter.number}/p-${String(pageNumber).padStart(
          4,
          "0",
        )}.${ext}`;
        const publicUrl = await uploadBytes(path, bytes, contentType);
        const { error: pageError } = await supabaseAdmin.from("chapter_pages").insert({
          chapter_id: chapterId,
          page_number: pageNumber,
          image_url: publicUrl,
        });
        if (pageError) throw new Error(pageError.message);
        savedPages++;
      } catch (err) {
        throw new Error(`Chapter ${chapter.number} page ${pageNumber}: ${(err as Error).message}`);
      }
      pageNumber++;
    }

    chapters.push({
      chapterNumber: chapter.number,
      chapterId,
      savedPages,
      totalPages: chapter.imageUrls.length,
    });
  }

  return {
    seriesId,
    slug: seriesSlug,
    chapters,
  };
}

async function fetchScrapeSeries(data: z.input<typeof ScrapeSeriesRequestSchema>) {
  const endpoint = (process.env.SCRAPER_API_URL || DEFAULT_SCRAPE_SERIES_ENDPOINT).trim();
  const apiKey = process.env.SCRAPER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing SCRAPER_API_KEY");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(data),
  });

  const raw = await response.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const parsedMessage =
      parsed &&
      typeof parsed === "object" &&
      "message" in parsed &&
      typeof (parsed as { message?: unknown }).message === "string"
        ? ((parsed as { message: string }).message ?? null)
        : null;
    const message = parsedMessage ?? (raw.trim() || `Scrape failed (${response.status})`);
    throw new Error(message);
  }

  return ScrapeSeriesResponseSchema.parse(parsed);
}

function mapScrapeResponseToImport(
  payload: z.infer<typeof ScrapeSeriesResponseSchema>,
): GenericSeriesImport {
  return {
    title: payload.series.title,
    description: payload.series.description ?? null,
    author: payload.series.author ?? null,
    slug: payload.series.slug ?? undefined,
    type: "manga",
    status: payload.series.status ?? "ongoing",
    sourceUrl: payload.source_url,
    genres: payload.series.genres ?? [],
    chapters: payload.chapters.map((chapter) => ({
      number: chapter.number,
      title: chapter.title ?? null,
      price: 0,
      sourceUrl: chapter.sourceUrl ?? payload.source_url ?? undefined,
      imageUrls: chapter.images,
    })),
  };
}

export const importSeriesFromJson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GenericSeriesImportSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    return importGenericSeries(data);
  });

export const importSeriesFromSourceApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ScrapeSeriesRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const scraped = await fetchScrapeSeries(data);
    const mapped = mapScrapeResponseToImport(scraped);
    return importGenericSeries(mapped);
  });
