import { Link } from "@tanstack/react-router";
import type { Tables } from "@/integrations/supabase/types";
import { resolveImage, onImageError } from "@/lib/image";
import { GenreTag } from "@/components/genre-tag";

export function SeriesCard({
  series,
}: {
  series: Pick<Tables<"series">, "slug" | "title" | "cover_url" | "type" | "genres">;
}) {
  const typeLabel = series.type === "manga" ? "Manga" : "Novel";
  const firstGenre = series.genres?.[0];

  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="group block"
    >
      <div
        className="glow-halo relative aspect-[2/3] overflow-hidden rounded-xl bg-muted
                   shadow-card ring-1 ring-border/50
                   transition-all duration-500 ease-out
                   group-hover:-translate-y-1 group-hover:shadow-elev group-hover:ring-primary/50"
      >
        <img
          src={resolveImage(series.cover_url)}
          onError={onImageError}
          alt={series.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
        />
        {/* Gradient veil */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
        {/* Aurora hover glow */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-60 transition-opacity duration-500 mix-blend-overlay pointer-events-none"
          style={{ background: "var(--gradient-aurora)" }}
          aria-hidden
        />
        {/* Type chip */}
        <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white backdrop-blur-md ring-1 ring-white/10">
          {typeLabel}
        </span>
        {/* Title */}
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <h3 className="line-clamp-2 text-[13px] font-extrabold leading-tight text-white drop-shadow-md group-hover:text-primary transition-colors">
            {series.title}
          </h3>
        </div>
      </div>
      {firstGenre && (
        <div className="pt-2 flex">
          <GenreTag name={firstGenre} size="xs" asLink={false} />
        </div>
      )}
    </Link>
  );
}
