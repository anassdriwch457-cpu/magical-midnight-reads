import { Link } from "@tanstack/react-router";
import { type Tables } from "@/lib/data-client";
import { resolveImage, onImageError } from "@/lib/image";
import { GenreTag } from "@/components/genre-tag";
import { motion, SPRING, useReducedMotion } from "@/lib/motion";

export function SeriesCard({
  series,
}: {
  series: Pick<Tables<"series">, "slug" | "title" | "cover_url" | "type" | "genres">;
}) {
  const reduced = useReducedMotion();
  const typeLabel = series.type === "manga" ? "Manga" : "Novel";
  const firstGenre = series.genres?.[0];

  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="focus-ring group block rounded-xl"
    >
      <motion.div
        whileHover={reduced ? undefined : { y: -6, scale: 1.025 }}
        whileTap={reduced ? undefined : { scale: 0.98 }}
        transition={SPRING.soft}
        className="glow-halo relative aspect-[2/3] overflow-hidden rounded-2xl bg-muted
                   shadow-card ring-1 ring-white/10
                   group-hover:shadow-elev group-hover:ring-primary/40 will-change-transform transition-shadow duration-300"
      >
        <img
          src={resolveImage(series.cover_url)}
          onError={onImageError}
          alt={series.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
        />
        {/* Gradient veil */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        {/* Aurora hover glow */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-50 transition-opacity duration-500 mix-blend-overlay pointer-events-none"
          style={{ background: "var(--gradient-aurora)" }}
          aria-hidden
        />
        {/* Type chip */}
        <span className="absolute left-2.5 top-2.5 rounded-md bg-black/45 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur-md ring-1 ring-white/10">
          {typeLabel}
        </span>
        {/* Title */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug tracking-tight text-white drop-shadow-md group-hover:text-primary transition-colors duration-300">
            {series.title}
          </h3>
        </div>
      </motion.div>
      {firstGenre && (
        <div className="pt-2 flex">
          <GenreTag name={firstGenre} size="xs" asLink={false} />
        </div>
      )}
    </Link>
  );
}
