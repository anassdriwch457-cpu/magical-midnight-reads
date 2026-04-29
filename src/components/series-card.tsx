import { Link } from "@tanstack/react-router";
import type { Tables } from "@/integrations/supabase/types";

export function SeriesCard({ series }: { series: Pick<Tables<"series">, "slug" | "title" | "cover_url" | "type" | "genres"> }) {
  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="group block"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-[4px] bg-muted shadow-card">
        {series.cover_url && (
          <img
            src={series.cover_url}
            alt={series.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
        <div className="absolute inset-0 ring-0 group-hover:ring-2 group-hover:ring-primary transition-all rounded-[4px]" />
      </div>
      <div className="pt-2.5">
        <h3 className="line-clamp-1 font-bold text-sm text-foreground group-hover:text-primary transition-colors">
          {series.title}
        </h3>
        <p className="line-clamp-1 text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
          {series.type === "manga" ? "Manga" : "Novel"}
          {series.genres?.[0] ? ` · ${series.genres[0]}` : ""}
        </p>
      </div>
    </Link>
  );
}
