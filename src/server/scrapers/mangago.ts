/**
 * Mangago.me scraper. Server-only.
 *
 * Mangago serves images via mangapicgallery.com with hotlink protection;
 * downloads MUST send a Referer of the original page (or the site origin).
 *
 * Reading layout: each "pg-N" page renders TWO images (#page1 and #page2),
 * so we step by 2 when walking pages.
 */

const SITE_ORIGIN = "https://www.mangago.me";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Ch-Ua": '"Chromium";v="126", "Not.A/Brand";v="24", "Google Chrome";v="126"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  Referer: `${SITE_ORIGIN}/`,
};

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
  if (!res.ok) {
    if (res.status === 403 || res.status === 503) {
      throw new Error(
        `Mangago blocked the request (${res.status}). The site uses Cloudflare protection that this scraper can't bypass. Use the "Upload Chapter from URLs" tool with Google Drive or Gofile links instead.`,
      );
    }
    throw new Error(`Fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function abs(href: string): string {
  if (!href) return href;
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${SITE_ORIGIN}${href}`;
  return href;
}

export type ScrapedSeries = {
  title: string;
  description: string;
  coverUrl: string;
  status: "ongoing" | "completed" | "hiatus";
  genres: string[];
  author: string | null;
  slug: string;
  sourceUrl: string;
  chapters: Array<{ number: number; title: string | null; sourceUrl: string }>;
};

export async function scrapeMangagoSeries(seriesUrl: string): Promise<ScrapedSeries> {
  const html = await fetchHtml(seriesUrl);

  // Title
  const titleMatch = html.match(/<h1>\s*([\s\S]*?)\s*<\/h1>/);
  const title = titleMatch ? decode(titleMatch[1]) : "Untitled";

  // Cover
  const coverMatch = html.match(/<img[^>]*alt="[^"]*"[^>]*src="(https:\/\/[^"]*coverlink[^"]*)"/);
  const coverUrl = coverMatch ? coverMatch[1] : "";

  // Status
  const statusMatch = html.match(/<label>\s*Status:\s*<\/label>\s*([\s\S]*?)<\/li>/i);
  const rawStatus = statusMatch ? decode(statusMatch[1]).toLowerCase() : "ongoing";
  const status: ScrapedSeries["status"] = rawStatus.includes("complete")
    ? "completed"
    : rawStatus.includes("hiatus")
      ? "hiatus"
      : "ongoing";

  // Author
  const authorMatch = html.match(/<label>\s*Author:\s*<\/label>([\s\S]*?)<\/li>/i);
  const author = authorMatch ? decode(authorMatch[1]) || null : null;

  // Genres
  const genres: string[] = [];
  const genreSection = html.match(/Genre\(s\):([\s\S]*?)<\/li>/);
  if (genreSection) {
    const linkRe = /<a[^>]*href="[^"]*\/genre\/[^"]*"[^>]*>([^<]+)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(genreSection[1])) !== null) {
      const g = decode(m[1]);
      if (g) genres.push(g);
    }
  }

  // Description (manga_summary)
  let description = "";
  const summaryMatch = html.match(
    /<div class="also_like"[^>]*>\s*<h4>Summary<\/h4>\s*<\/div>\s*<div class="manga_summary"[^>]*>([\s\S]*?)<\/div>/,
  );
  if (summaryMatch) description = decode(summaryMatch[1]);

  // Chapters — table.listing#chapter_table contains <a class="chico" href="...">
  const chapters: ScrapedSeries["chapters"] = [];
  const tableMatch = html.match(
    /<table class="listing"[^>]*id="chapter_table"[^>]*>([\s\S]*?)<\/table>/,
  );
  const tableHtml = tableMatch ? tableMatch[1] : html;
  const chRe = /<a class="chico"[^>]*href="([^"]+)"[^>]*>\s*(?:<b[^>]*>([^<]*)<\/b>)?\s*([^<]*)/g;
  let cm: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((cm = chRe.exec(tableHtml)) !== null) {
    const href = abs(cm[1]);
    if (seen.has(href)) continue;
    seen.add(href);
    const bold = decode(cm[2] || "");
    const trail = decode(cm[3] || "");
    // Bold like "Ch.80" → number 80
    const numMatch = bold.match(/Ch\.?\s*([\d.]+)/i);
    const number = numMatch ? Number(numMatch[1]) : NaN;
    if (!Number.isFinite(number)) continue;
    const cleanTrail = trail.replace(/^[\s:.\-]+/, "").trim();
    chapters.push({
      number,
      title: cleanTrail || null,
      sourceUrl: href,
    });
  }
  // List is newest-first; sort ascending so import processes Ch.1 first.
  chapters.sort((a, b) => a.number - b.number);

  // Slug from URL
  const slugMatch = seriesUrl.match(/\/read-manga\/([^/]+)/);
  const slug = slugMatch ? slugMatch[1] : title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return {
    title,
    description,
    coverUrl,
    status,
    genres,
    author,
    slug,
    sourceUrl: seriesUrl,
    chapters,
  };
}

/**
 * Walk every reader page (pg-1, pg-3, pg-5, ...) and collect the unique
 * image URLs in order. Mangago serves 2 images per pg-N page (#page1, #page2).
 * The first page tells us the total page count via #pagenavigation.
 */
export async function scrapeMangagoChapterImages(chapterUrl: string): Promise<string[]> {
  const base = chapterUrl.replace(/\/pg-\d+\/?$/, "/");
  const firstHtml = await fetchHtml(`${base}pg-1/`);

  // Find total page count from page navigation links (1..N)
  let totalPages = 1;
  const navMatches = firstHtml.matchAll(/\/pg-(\d+)\//g);
  for (const m of navMatches) {
    const n = Number(m[1]);
    if (n > totalPages) totalPages = n;
  }

  const collected: string[] = [];
  const collectFromHtml = (html: string) => {
    // Both #page1 and #page2 imgs.
    const imgRe = /<img[^>]*id="page[12]"[^>]*src="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = imgRe.exec(html)) !== null) {
      const u = m[1];
      if (u && !collected.includes(u)) collected.push(u);
    }
  };
  collectFromHtml(firstHtml);

  // Step by 2 since each page yields 2 images.
  const failedPages: number[] = [];
  for (let p = 3; p <= totalPages; p += 2) {
    try {
      const html = await fetchHtml(`${base}pg-${p}/`);
      collectFromHtml(html);
      // Be polite — small jitter
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`[mangago] failed pg-${p}`, err);
      failedPages.push(p);
    }
  }

  if (failedPages.length > 0) {
    console.warn(
      `[mangago] ${failedPages.length}/${Math.ceil(totalPages / 2)} reader pages failed: ${failedPages.join(", ")}`,
    );
  }

  return collected;
}

/** Download an image with Mangago referer and return bytes + content-type. */
export async function downloadImage(
  imageUrl: string,
  refererUrl: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(imageUrl, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: refererUrl,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${imageUrl}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { bytes: buf, contentType };
}
