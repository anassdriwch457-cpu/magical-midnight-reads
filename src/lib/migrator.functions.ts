import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  scrapeMangagoSeries,
  scrapeMangagoChapterImages,
  downloadImage,
  type ScrapedSeries,
} from "./scrapers/mangago";

/* ============================== AUTH ============================== */

type DbClient = SupabaseClient<Database>;

function getDbClient(context?: { supabase?: DbClient }): DbClient {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY_PUBLIC
    ? (supabaseAdmin as DbClient)
    : (context?.supabase as DbClient);
}

async function assertStaff(db: DbClient, userId: string) {
  const { data: roles, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const ok = (roles ?? []).some(
    (r) => r.role === "admin" || r.role === "super_admin" || r.role === "manager",
  );
  if (!ok) throw new Error("Insufficient privileges");
}

/* ============================== HELPERS ============================== */

const BUCKET = "chapter-images";

async function uploadBytes(
  db: DbClient,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

async function appendLog(db: DbClient, jobId: string, line: string) {
  const { data: row } = await db.from("import_jobs").select("logs").eq("id", jobId).maybeSingle();
  const logs = [...((row?.logs as string[]) ?? []), `${new Date().toISOString()} ${line}`].slice(
    -200,
  );
  await db.from("import_jobs").update({ logs }).eq("id", jobId);
}

type JobPatch = Partial<{
  status: string;
  current_chapter: string | null;
  error: string | null;
  series_id: string | null;
  total_chapters: number;
  completed_chapters: number;
}>;

async function setJob(db: DbClient, jobId: string, patch: JobPatch) {
  await db.from("import_jobs").update(patch).eq("id", jobId);
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
    const db = getDbClient(context);
    await assertStaff(db, context.userId);

    const { data: row, error } = await db
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
    const db = getDbClient(context);
    await assertStaff(db, context.userId);
    const { data, error } = await db
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
    const db = getDbClient(context);
    await assertStaff(db, context.userId);
    const { data: job, error } = await db
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
    const db = getDbClient(context);
    await assertStaff(db, context.userId);

    const { data: job, error: jErr } = await db
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
        await setJob(db, job.id, { status: "scraping", current_chapter: "Fetching series page…" });
        await appendLog(db, job.id, `Scraping series ${job.source_url}`);

        let scraped: ScrapedSeries;
        if (job.source_site === "mangago") {
          scraped = await scrapeMangagoSeries(job.source_url);
        } else {
          throw new Error(`Unsupported source site: ${job.source_site}`);
        }

        const scrapedChapters = scraped.chapters ?? [];
        await appendLog(
          db,
          job.id,
          `Found "${scraped.title}" with ${scrapedChapters.length} chapters`,
        );

        // Dedupe: if a series with this source_url already exists, reuse it.
        const { data: existing } = await db
          .from("series")
          .select("id")
          .eq("source_url", scraped.sourceUrl)
          .maybeSingle();

        let seriesId: string;
        if (existing) {
          seriesId = existing.id;
          await appendLog(db, job.id, `Reusing existing series row ${seriesId}`);
        } else {
          // Upload cover
          let coverPublicUrl: string | null = null;
          if (scraped.coverUrl) {
            try {
              const { bytes, contentType } = await downloadImage(scraped.coverUrl, job.source_url);
              const ext = extFromContentType(contentType);
              coverPublicUrl = await uploadBytes(
                db,
                `import/${scraped.slug}/cover.${ext}`,
                bytes,
                contentType,
              );
            } catch (err) {
              await appendLog(
                db,
                job.id,
                `Cover download failed: ${(err as Error).message} (continuing)`,
              );
            }
          }

          // Make slug unique
          let slug = scraped.slug;
          for (let i = 2; i < 50; i++) {
            const { data: clash } = await db
              .from("series")
              .select("id")
              .eq("slug", slug)
              .maybeSingle();
            if (!clash) break;
            slug = `${scraped.slug}-${i}`;
          }

          const { data: created, error: cErr } = await db
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
          await appendLog(db, job.id, `Created series ${seriesId} (slug: ${slug})`);
        }

        // Insert any missing chapter rows (no pages yet).
        for (const ch of scrapedChapters) {
          const { data: existingCh } = await db
            .from("chapters")
            .select("id")
            .eq("series_id", seriesId)
            .eq("number", ch.number)
            .maybeSingle();
          if (!existingCh) {
            await db.from("chapters").insert({
              series_id: seriesId,
              number: ch.number,
              title: ch.title,
              price: 0,
              source_url: ch.sourceUrl,
            });
          } else if (ch.sourceUrl) {
            await db.from("chapters").update({ source_url: ch.sourceUrl }).eq("id", existingCh.id);
          }
        }

        await setJob(db, job.id, {
          series_id: seriesId,
          status: "importing_chapters",
          total_chapters: scrapedChapters.length,
          completed_chapters: 0,
          current_chapter: "Ready to import chapters",
        });
        await appendLog(db, job.id, `Series ready. Importing ${scrapedChapters.length} chapters…`);

        const { data: refreshed } = await db
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
        const { data: chapters } = await db
          .from("chapters")
          .select("id, number, title, source_url")
          .eq("series_id", job.series_id)
          .not("source_url", "is", null)
          .order("number", { ascending: true });

        const all = chapters ?? [];
        let next: (typeof all)[number] | null = null;
        let completed = 0;
        for (const ch of all) {
          const { count } = await db
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
          await setJob(db, job.id, {
            status: "done",
            completed_chapters: all.length,
            current_chapter: null,
          });
          await appendLog(db, job.id, `All chapters imported. Job done.`);
          const { data: refreshed } = await db
            .from("import_jobs")
            .select("*")
            .eq("id", job.id)
            .single();
          return { job: refreshed };
        }

        await setJob(db, job.id, {
          completed_chapters: completed,
          current_chapter: `Ch.${next.number}${next.title ? ` — ${next.title}` : ""}`,
        });
        await appendLog(db, job.id, `Importing Ch.${next.number} from ${next.source_url}`);

        // Scrape image URLs
        const imgs = await scrapeMangagoChapterImages(next.source_url!);
        await appendLog(db, job.id, `Found ${imgs.length} images for Ch.${next.number}`);

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
            const publicUrl = await uploadBytes(db, path, bytes, contentType);
            await db.from("chapter_pages").insert({
              chapter_id: next.id,
              page_number: pageNum,
              image_url: publicUrl,
            });
            pageNum++;
          } catch (err) {
            await appendLog(
              db,
              job.id,
              `Page ${pageNum} failed for Ch.${next.number}: ${(err as Error).message}`,
            );
          }
        }

        await setJob(db, job.id, {
          completed_chapters: completed + 1,
        });
        await appendLog(
          db,
          job.id,
          `Ch.${next.number} done (${pageNum - 1}/${imgs.length} pages saved)`,
        );

        const { data: refreshed } = await db
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
      await appendLog(db, job.id, `ERROR: ${msg}`);
      await setJob(db, job.id, { status: "failed", error: msg });
      const { data: refreshed } = await db
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
    const db = getDbClient(context);
    await assertStaff(db, context.userId);
    await setJob(db, data.jobId, { status: "failed", error: "Cancelled by user" });
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
  coverUrl: z.string().url().max(2000).nullable().optional(),
  genres: z.array(z.string().min(1).max(50)).max(20).optional().default([]),
  chapters: z.array(GenericChapterSchema).min(1).max(200).optional(),
  imageUrls: z.array(z.string().url().max(2000)).min(1).max(500).optional(),
});

type GenericSeriesImport = z.infer<typeof GenericSeriesImportSchema>;

const FIRECRAWL_SCRAPE_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";

const ScrapeSeriesRequestSchema = z.object({
  url: z.string().url().max(500),
  site: z.enum(["mangabuddy", "kunmanga", "comix"]),
  includeChapterImages: z.boolean().optional().default(false),
  chapterLimit: z.number().int().min(1).max(200).optional().default(50),
});

const FirecrawlScrapeResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z
    .object({
      markdown: z.string().optional(),
      rawHtml: z.string().optional(),
      html: z.string().optional(),
      links: z.array(z.string().url().max(2000)).optional().default([]),
      metadata: z.record(z.string(), z.unknown()).optional().default({}),
    })
    .optional(),
});

type FirecrawlScrapeResponse = z.infer<typeof FirecrawlScrapeResponseSchema>;

const FirecrawlInteractResponseSchema = z.object({
  success: z.boolean().optional(),
  output: z.string().optional(),
  stdout: z.string().optional(),
  result: z.string().optional(),
  stderr: z.string().optional(),
  error: z.string().optional(),
  exitCode: z.number().optional(),
  killed: z.boolean().optional(),
});

function firstString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataString(metadata: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = firstString(metadata[key]);
    if (value) return value;
  }
  return null;
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizeChapterTitle(title: string | null | undefined): string | null {
  const value = title?.trim();
  return value ? value : null;
}

function parseChapterNumberFromText(text: string): number | null {
  const match = text.match(/(?:Ch\.?|Chapter)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : null;
}

function parseChapterNumberFromUrl(url: string): number | null {
  const patterns = [
    /(?:chapter|ch)[-_/. ]*([0-9]+(?:\.[0-9]+)?)/i,
    /\/([0-9]+(?:\.[0-9]+)?)\s*[-_]?chapter/i,
    /\/chapters?\/([0-9]+(?:\.[0-9]+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (!match) continue;
    const number = Number(match[1]);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function extractSeriesChapterLinks(
  markdown: string,
  links: string[],
  sourceUrl: string,
): Array<{ number: number; title: string | null; sourceUrl: string }> {
  const sourceOrigin = new URL(sourceUrl).origin;
  const candidates = new Map<string, { number: number; title: string | null; sourceUrl: string }>();

  const addCandidate = (
    sourceUrlCandidate: string,
    number: number | null,
    title: string | null,
  ) => {
    if (!sourceUrlCandidate.startsWith("http")) return;
    const parsed = new URL(sourceUrlCandidate);
    if (parsed.origin !== sourceOrigin) return;
    const path = parsed.pathname.toLowerCase();
    if (
      !/chapter|chapters|ch-|\bch\./i.test(path) &&
      !/chapter|chapters|ch-|\bch\./i.test(title ?? "")
    ) {
      return;
    }
    const resolvedNumber =
      number ?? parseChapterNumberFromUrl(sourceUrlCandidate) ?? candidates.size + 1;
    const existing = candidates.get(sourceUrlCandidate);
    if (!existing || resolvedNumber < existing.number) {
      candidates.set(sourceUrlCandidate, {
        number: resolvedNumber,
        title: normalizeChapterTitle(title),
        sourceUrl: sourceUrlCandidate,
      });
    }
  };

  const markdownLinkRe =
    /\[([^\]]*?(?:Ch\.?|Chapter)\s*[0-9]+(?:\.[0-9]+)?[^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;
  for (const match of markdown.matchAll(markdownLinkRe)) {
    addCandidate(match[2], parseChapterNumberFromText(match[1]), match[1]);
  }

  const markdownUrlRe = /(https?:\/\/[^\s)]+chapter[^\s)]*)/gi;
  for (const match of markdown.matchAll(markdownUrlRe)) {
    addCandidate(match[1], parseChapterNumberFromUrl(match[1]), null);
  }

  for (const link of links) {
    addCandidate(link, parseChapterNumberFromUrl(link), null);
  }

  return [...candidates.values()].sort((a, b) => a.number - b.number);
}

function extractImageUrls(content: string): string[] {
  const urls: string[] = [];
  const rawHtmlImageRe =
    /<img[^>]*class="[^"]*rpage-page__img[^"]*"[^>]*src="(https?:\/\/[^"]+)"/gi;
  for (const match of content.matchAll(rawHtmlImageRe)) {
    urls.push(match[1]);
  }
  const markdownImageRe = /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/gi;
  for (const match of content.matchAll(markdownImageRe)) {
    urls.push(match[1]);
  }
  return uniqueUrls(urls);
}

async function fetchFirecrawlScrape(
  url: string,
  formats: Array<"markdown" | "links" | "html" | "rawHtml"> = ["markdown", "links", "rawHtml"],
): Promise<FirecrawlScrapeResponse> {
  const response = await fetch(FIRECRAWL_SCRAPE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats,
      onlyMainContent: false,
    }),
  });

  const raw = await response.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as { error?: unknown }).error === "string"
        ? ((parsed as { error: string }).error ?? null)
        : raw.trim() || `Firecrawl scrape failed (${response.status})`;
    throw new Error(message);
  }

  return FirecrawlScrapeResponseSchema.parse(parsed);
}

async function fetchFirecrawlInteract(
  scrapeId: string,
  input: {
    prompt?: string;
    code?: string;
    language?: "node" | "python" | "bash";
    timeout?: number;
  },
): Promise<string> {
  const response = await fetch(`https://api.firecrawl.dev/v2/scrape/${scrapeId}/interact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const raw = await response.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as { error?: unknown }).error === "string"
        ? ((parsed as { error: string }).error ?? null)
        : raw.trim() || `Firecrawl interact failed (${response.status})`;
    throw new Error(message);
  }

  const output = FirecrawlInteractResponseSchema.parse(parsed);
  return output.output ?? output.stdout ?? output.result ?? "";
}

function parseJsonArrayFromText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const fenceMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = (fenceMatch?.[1] ?? trimmed).trim();
  try {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === "string");
    }
  } catch {
    // fall through
  }

  return candidate
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^https?:\/\//i.test(line));
}

async function importGenericSeries(db: DbClient, data: GenericSeriesImport) {
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
    const { data: existing, error } = await db
      .from("series")
      .select("id, slug")
      .eq("source_url", data.sourceUrl)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (existing) {
      seriesId = existing.id;
      seriesSlug = existing.slug;
      const { error: updateError } = await db
        .from("series")
        .update({
          title: data.title,
          description: data.description ?? null,
          author: data.author ?? null,
          status: data.status,
          type: data.type,
          genres: data.genres,
          source_url: data.sourceUrl,
          cover_url: data.coverUrl ?? null,
        })
        .eq("id", seriesId);
      if (updateError) throw new Error(`Update series failed: ${updateError.message}`);
    }
  }

  if (!seriesId) {
    let candidate = seriesSlug;
    for (let i = 2; ; i++) {
      const { data: clash, error } = await db
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

    const { data: created, error } = await db
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
        cover_url: data.coverUrl ?? null,
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
    const { data: existingChapter, error: chapterLookupError } = await db
      .from("chapters")
      .select("id")
      .eq("series_id", resolvedSeriesId)
      .eq("number", chapter.number)
      .maybeSingle();
    if (chapterLookupError) throw new Error(chapterLookupError.message);

    let chapterId: string;
    if (existingChapter) {
      chapterId = existingChapter.id;
      const { error: updateError } = await db
        .from("chapters")
        .update({
          title: chapter.title ?? null,
          price: chapter.price ?? 0,
          source_url: chapter.sourceUrl ?? null,
        })
        .eq("id", chapterId);
      if (updateError) throw new Error(`Update chapter failed: ${updateError.message}`);
      const { error: deletePagesError } = await db
        .from("chapter_pages")
        .delete()
        .eq("chapter_id", chapterId);
      if (deletePagesError) throw new Error(deletePagesError.message);
    } else {
      const { data: createdChapter, error: createChapterError } = await db
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
        const publicUrl = await uploadBytes(db, path, bytes, contentType);
        const { error: pageError } = await db.from("chapter_pages").insert({
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

async function scrapeSeriesWithFirecrawl(
  data: z.input<typeof ScrapeSeriesRequestSchema>,
): Promise<GenericSeriesImport> {
  const seriesPage = await fetchFirecrawlScrape(data.url, ["markdown", "links", "rawHtml"]);
  const markdown = seriesPage.data?.markdown ?? "";
  const metadata = seriesPage.data?.metadata ?? {};
  const links = seriesPage.data?.links ?? [];

  const sourceUrl = metadataString(metadata, "sourceURL", "url") ?? data.url;
  const title =
    metadataString(metadata, "ogTitle", "title") ??
    markdown
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("[") && !line.includes("Comment"))
      ?.slice(0, 255) ??
    "Untitled";
  const description = metadataString(metadata, "ogDescription", "description");
  const coverUrl = metadataString(metadata, "ogImage", "image", "favicon");
  const slug = sourceUrl.replace(/\/+$/, "").split("/").filter(Boolean).pop() ?? undefined;

  const seriesChapters = extractSeriesChapterLinks(markdown, links, sourceUrl).slice(
    0,
    data.chapterLimit,
  );
  if (seriesChapters.length === 0) {
    throw new Error("No chapters found on the series page");
  }

  const chapters: GenericSeriesImport["chapters"] = [];
  for (const chapter of seriesChapters) {
    const chapterPage = await fetchFirecrawlScrape(chapter.sourceUrl, ["markdown", "rawHtml"]);
    const scrapeId = firstString(chapterPage.data?.metadata?.scrapeId);
    let imageUrls: string[] = [];
    if (scrapeId) {
      const interactOutput = await fetchFirecrawlInteract(scrapeId, {
        code: [
          "const collected = new Set();",
          "for (let i = 1; i <= 200; i++) {",
          '  const button = page.getByRole("button", { name: `Go to page ${i}`, exact: true });',
          "  if ((await button.count()) === 0) break;",
          "  await button.click();",
          "  await page.waitForTimeout(400);",
          '  const srcs = await page.$$eval("img.rpage-page__img", (imgs) => imgs.map((img) => img.getAttribute("src")).filter(Boolean));',
          "  for (const src of srcs) collected.add(src);",
          "}",
          "JSON.stringify([...collected]);",
        ].join("\n"),
        language: "node",
        timeout: 180,
      });
      imageUrls = parseJsonArrayFromText(interactOutput);
    }
    if (imageUrls.length === 0) {
      const chapterContent = chapterPage.data?.rawHtml ?? chapterPage.data?.markdown ?? "";
      imageUrls = extractImageUrls(chapterContent);
    }
    if (imageUrls.length === 0) {
      throw new Error(`No page images found for chapter ${chapter.number}`);
    }
    chapters.push({
      number: chapter.number,
      title: chapter.title,
      price: 0,
      sourceUrl: chapter.sourceUrl,
      imageUrls,
    });
  }

  return {
    title,
    description,
    author: null,
    slug,
    type: "manga",
    status: "ongoing",
    sourceUrl,
    coverUrl,
    genres: [],
    chapters,
  };
}

export const importSeriesFromJson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GenericSeriesImportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = getDbClient(context);
    await assertStaff(db, context.userId);
    return importGenericSeries(db, data);
  });

export const importSeriesFromSourceApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ScrapeSeriesRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = getDbClient(context);
    await assertStaff(db, context.userId);
    const mapped = await scrapeSeriesWithFirecrawl(data);
    return importGenericSeries(db, mapped);
  });

const JsonUrlImportSchema = z.object({
  url: z.string().url().max(2000),
});

export const importSeriesFromJsonUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => JsonUrlImportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = getDbClient(context);
    await assertStaff(db, context.userId);

    const response = await fetch(data.url, {
      headers: {
        Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Fetch failed (${response.status}): ${body.slice(0, 200)}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error("JSON URL did not return valid JSON");
    }

    const mapped = GenericSeriesImportSchema.parse(parsed);
    return importGenericSeries(db, mapped);
  });
