import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CHAPTER_IMAGES_BUCKET = "chapter-images";

/**
 * Assert the given user has a staff-level role.
 * Throws if the user lacks admin, super_admin, or manager role.
 */
export async function assertStaff(userId: string) {
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

/** Map a content-type header to a file extension. */
export function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

/** Upload bytes to the chapter-images bucket and return the public URL. */
export async function uploadToStorage(
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const { error } = await supabaseAdmin.storage
    .from(CHAPTER_IMAGES_BUCKET)
    .upload(path, bytes, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(CHAPTER_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
