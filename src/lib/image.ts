// Public placeholder hosted in the public storage bucket so it works in production.
export const PLACEHOLDER_COVER =
  "https://ufazpefxyapzttdngyhi.supabase.co/storage/v1/object/public/chapter-images/seed/placeholder.png";

/**
 * Resolve any stored image path/URL into a real, loadable URL.
 * - Returns the placeholder when value is null/empty.
 * - Passes through full http(s) URLs.
 * - Rewrites legacy dev-only `/src/assets/...` paths into the seeded public bucket URL.
 */
export function resolveImage(url: string | null | undefined): string {
  if (!url) return PLACEHOLDER_COVER;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/src/assets/")) {
    const file = url.replace(/^\/src\/assets\//, "");
    return `https://ufazpefxyapzttdngyhi.supabase.co/storage/v1/object/public/chapter-images/seed/${file}`;
  }
  return url;
}

/** onError handler that swaps a broken image for the placeholder. */
export function onImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src !== PLACEHOLDER_COVER) img.src = PLACEHOLDER_COVER;
}
