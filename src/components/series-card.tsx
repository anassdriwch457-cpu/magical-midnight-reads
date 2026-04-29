import { Link } from "@tanstack/react-router";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";

export function SeriesCard({ series }: { series: Pick<Tables<"series">, "slug" | "title" | "cover_url" | "type" | "genres"> }) {
  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="group block overflow-hidden rounded-lg bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        {series.cover_url && (
          <img src={series.cover_url} alt={series.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
        <Badge className="absolute top-2 right-2 capitalize bg-brand text-primary-foreground border-0">{series.type}</Badge>
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 font-semibold text-sm group-hover:text-primary transition-colors">{series.title}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground mt-0.5">{series.genres?.slice(0, 2).join(" · ")}</p>
      </div>
    </Link>
  );
}
