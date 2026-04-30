import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { resolveImage, onImageError } from "@/lib/image";

type Series = Pick<Tables<"series">, "id" | "slug" | "title" | "cover_url" | "type">;
type Chapter = Pick<Tables<"chapters">, "id" | "number" | "price" | "created_at">;

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export function LatestUpdateCard({
  series,
  chapters,
}: {
  series: Series;
  chapters: Chapter[];
}) {
  const isNew = (createdAt: string) => Date.now() - new Date(createdAt).getTime() < 1000 * 60 * 60 * 48;

  return (
    <div className="flex gap-3 rounded-2xl overflow-hidden glass-card hover:ring-1 hover:ring-primary/40 transition-all duration-300 shadow-card hover:shadow-elev hover:-translate-y-0.5">
      <Link
        to="/series/$slug"
        params={{ slug: series.slug }}
        className="shrink-0 w-[92px] sm:w-[110px] aspect-[2/3] bg-muted overflow-hidden group"
      >
        <img
          src={resolveImage(series.cover_url)}
          onError={onImageError}
          alt={series.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
        />
      </Link>

      <div className="flex-1 min-w-0 py-2 pr-2 flex flex-col">
        <Link
          to="/series/$slug"
          params={{ slug: series.slug }}
          className="block px-2"
        >
          <h3 className="font-bold text-sm text-foreground hover:text-primary transition-colors line-clamp-1">
            {series.title}
          </h3>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
            {series.type === "manga" ? "Manga" : "Novel"}
          </p>
        </Link>

        <ul className="mt-1.5 flex-1 divide-y divide-border/60">
          {chapters.length === 0 && (
            <li className="px-2 py-2 text-xs text-muted-foreground">No chapters yet</li>
          )}
          {chapters.map((c) => {
            const free = c.price === 0;
            const fresh = isNew(c.created_at);
            return (
              <li key={c.id}>
                <Link
                  to="/series/$slug/chapter/$number"
                  params={{ slug: series.slug, number: String(c.number) }}
                  className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-2 px-2 py-1.5 hover:bg-white/5 transition-colors group"
                >
                  <span
                    className={`text-xs font-semibold tabular-nums truncate ${
                      free ? "text-white/85 group-hover:text-white" : "text-[#F47521]"
                    }`}
                  >
                    Ch. {Number(c.number)}
                  </span>

                  <span className="flex items-center gap-1.5 min-w-0">
                    {free
                      ? fresh && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-white/10 text-white/70">
                            New
                          </span>
                        )
                      : (
                        <>
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#F47521]">
                            <Coins className="h-3 w-3" /> {c.price}
                          </span>
                          {fresh && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-[#F47521] text-black">
                              New
                            </span>
                          )}
                        </>
                      )}
                  </span>

                  <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap text-right">
                    {timeAgo(c.created_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
