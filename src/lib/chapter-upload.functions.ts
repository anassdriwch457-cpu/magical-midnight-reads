import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type DbClient = SupabaseClient<Database>;

function getDbClient(context?: { supabase?: DbClient }): DbClient {
  return context?.supabase as DbClient;
}

const BUCKET = "chapter-images";

async function assertStaff(db: DbClient, userId: string) {
  const { data: roles, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const ok = (roles ?? []).some(
    (r) => r.role === "admin" || r.role === "super_admin" || r.role === "manager",
  );
  if (!ok) throw new Error("Insufficient privileges");
}

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Convert a user-pasted URL into a direct download URL.
 * - Google Drive `file/d/ID/view` or `?id=ID` → `uc?export=download&id=ID`
 * - Gofile direct links pass through (admin must use the "Direct Link" from gofile)
 * - Any other absolute http(s) URL passes through.
 */
function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";

  // Google Drive: /file/d/{id}/...
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveFile) {
    return `https://drive.google.com/uc?export=download&id=${driveFile[1]}`;
  }
  // Google Drive: ?id=...
  const driveOpen = url.match(/drive\.google\.com\/(?:open|uc)\?[^#]*[?&]?id=([^&]+)/);
  if (driveOpen) {
    return `https://drive.google.com/uc?export=download&id=${driveOpen[1]}`;
  }
  // Google Drive: googleusercontent.com direct already
  return url;
}

async function downloadOne(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  const ct = res.headers.get("content-type") || "image/jpeg";
  if (ct.startsWith("text/html")) {
    throw new Error(
      `Got HTML instead of an image. For Google Drive, make sure the file is shared "Anyone with the link". For Gofile, use the direct download URL.`,
    );
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, contentType: ct };
}

const UploadSchema = z.object({
  seriesId: z.string().uuid(),
  chapterNumber: z.number().min(0).max(100000),
  chapterTitle: z.string().max(255).optional().nullable(),
  price: z.number().min(0).max(100000).default(0),
  imageUrls: z.array(z.string().min(1).max(2000)).min(1).max(500),
});

export const uploadChapterFromUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = getDbClient(context);
    await assertStaff(db, context.userId);

    // Find or create chapter
    const { data: existing } = await db
      .from("chapters")
      .select("id")
      .eq("series_id", data.seriesId)
      .eq("number", data.chapterNumber)
      .maybeSingle();

    let chapterId: string;
    if (existing) {
      chapterId = existing.id;
      await db
        .from("chapters")
        .update({ title: data.chapterTitle ?? null, price: data.price })
        .eq("id", chapterId);
      // Wipe existing pages so re-upload replaces them
      await db.from("chapter_pages").delete().eq("chapter_id", chapterId);
    } else {
      const { data: created, error } = await db
        .from("chapters")
        .insert({
          series_id: data.seriesId,
          number: data.chapterNumber,
          title: data.chapterTitle ?? null,
          price: data.price,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Create chapter failed: ${error.message}`);
      chapterId = created.id;
    }

    const errors: string[] = [];
    let saved = 0;
    let pageNum = 1;

    for (const raw of data.imageUrls) {
      const url = normalizeUrl(raw);
      if (!url) continue;
      try {
        const { bytes, contentType } = await downloadOne(url);
        const ext = extFromContentType(contentType);
        const path = `upload/${data.seriesId.slice(0, 8)}/ch-${data.chapterNumber}/p-${String(
          pageNum,
        ).padStart(4, "0")}.${ext}`;
        const { error: upErr } = await db.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType, upsert: true, cacheControl: "31536000" });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
        const { error: insErr } = await db.from("chapter_pages").insert({
          chapter_id: chapterId,
          page_number: pageNum,
          image_url: pub.publicUrl,
        });
        if (insErr) throw new Error(insErr.message);
        saved++;
        pageNum++;
      } catch (err) {
        errors.push(`Page ${pageNum}: ${(err as Error).message}`);
        pageNum++;
      }
    }

    return {
      chapterId,
      saved,
      total: data.imageUrls.length,
      errors,
    };
  });

export const listSeriesForUpload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = getDbClient(context);
    await assertStaff(db, context.userId);
    const { data, error } = await db
      .from("series")
      .select("id, title, slug, type")
      .order("title", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    return { series: data ?? [] };
  });
