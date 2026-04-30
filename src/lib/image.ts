// Default placeholder image
export const PLACEHOLDER_COVER =
  "https://picsum.photos/seed/placeholder/600/900";

/**
 * Resolve any stored image path/URL into a real, loadable URL.
 * - Returns the placeholder when value is null/empty.
 * - Passes through full http(s) URLs.
 */
export function resolveImage(url: string | null | undefined): string {
  if (!url) return PLACEHOLDER_COVER;
  if (/^https?:\/\//i.test(url)) return url;
  return url;
}

/** onError handler that swaps a broken image for the placeholder. */
export function onImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src !== PLACEHOLDER_COVER) img.src = PLACEHOLDER_COVER;
}
