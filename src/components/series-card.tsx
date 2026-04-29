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
      className="group block animate-fade-in"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted shadow-card ring-1 ring-border/40 transition-all duration-300 group-hover:ring-primary/70 group-hover:shadow-glow group-hover:-translate-y-0.5">
        <img
          src={resolveImage(series.cover_url)}
          onError={onImageError}
          alt={series.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />
        {/* gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-90" />
        {/* type badge */}
        <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white backdrop-blur-md">
          {typeLabel}
        </span>
        {/* title over image */}
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
