import { Link } from "@tanstack/react-router";
import type { Tables } from "@/integrations/supabase/types";
import { resolveImage, onImageError } from "@/lib/image";
import { GenreTag } from "@/components/genre-tag";
import { Eye, Play } from "lucide-react";
import { motion, SPRING, useReducedMotion } from "@/lib/motion";

type Series = Pick<
  Tables<"series">,
  "slug" | "title" | "cover_url" | "banner_url" | "type" | "genres" | "description" | "views"
>;

/**
 * Tall vertical "More like this" recommendation banner with cinematic hover.
 */
export function BigRecCard({ series }: { series: Series }) {
  const reduced = useReducedMotion();
  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="focus-ring rounded-2xl block"
    >
      <motion.div
        whileHover={reduced ? undefined : { y: -8, scale: 1.02 }}
        whileTap={reduced ? undefined : { scale: 0.985 }}
        transition={SPRING.soft}
        className="group glow-halo relative block overflow-hidden rounded-2xl shadow-card ring-1 ring-border/50
                   hover:shadow-elev will-change-transform"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          <img
            src={resolveImage(series.banner_url ?? series.cover_url)}
            onError={onImageError}
            alt={series.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[1100ms] ease-out group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent" />
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-50 transition-opacity duration-500 mix-blend-overlay"
            style={{ background: "var(--gradient-aurora)" }}
            aria-hidden
          />
          {/* Hover Play badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            whileHover={{ opacity: 1, scale: 1 }}
            className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-aurora text-white shadow-glow opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Play className="h-4 w-4 fill-current" />
          </motion.div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4 space-y-2">
          <span className="inline-block rounded-md bg-black/55 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-white ring-1 ring-white/10 backdrop-blur-md">
            {series.type === "manga" ? "Manga" : "Novel"}
          </span>
          <h3 className="text-lg font-extrabold leading-tight text-white drop-shadow-lg group-hover:text-primary transition-colors line-clamp-2">
            {series.title}
          </h3>
          {series.description && (
            <p className="text-xs text-white/75 line-clamp-2 leading-relaxed">
              {series.description}
            </p>
          )}
          <div className="flex items-center gap-3 pt-1 text-[10px] text-white/65 font-bold uppercase tracking-[0.18em]">
            <span className="inline-flex items-center gap-1 font-mono"><Eye className="h-3 w-3" /> {series.views?.toLocaleString() ?? 0}</span>
          </div>
          {series.genres?.[0] && (
            <div className="flex flex-wrap gap-1 pt-1">
              {series.genres.slice(0, 2).map((g) => (
                <GenreTag key={g} name={g} size="xs" asLink={false} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
