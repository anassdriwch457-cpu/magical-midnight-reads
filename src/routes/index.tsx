import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase, type Tables } from "@/lib/data-client";
import { SeriesCard } from "@/components/series-card";
import { LatestUpdateCard } from "@/components/latest-update-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Play, Sparkles, Flame } from "lucide-react";
import { GenreBar } from "@/components/genre-bar";
import { SeriesCardSkeletonRow } from "@/components/series-card-skeleton";
import { resolveImage, onImageError } from "@/lib/image";
import {
  motion, AnimatePresence, SPRING, staggerContainer, staggerItem,
} from "@/lib/motion";
import { useScroll, useTransform, useReducedMotion } from "framer-motion";

type Series = Tables<"series">;
type Chapter = Tables<"chapters">;
type LatestEntry = { series: Series; chapters: Chapter[] };

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Nuvia Toon — Read Manga & Novels Online" },
      { name: "description", content: "Stream the latest manga and novels. New chapters every day." },
    ],
  }),
});

function HomePage() {
  const [trending, setTrending] = useState<Series[]>([]);
  const [popular, setPopular] = useState<Series[]>([]);
  const [novels, setNovels] = useState<Series[]>([]);
  const [latest, setLatest] = useState<LatestEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, p, n, l, settings] = await Promise.all([
          supabase.from("series").select("*").eq("is_trending", true).limit(5),
          supabase.from("series").select("*").eq("is_popular", true).eq("type", "manga").limit(12),
          supabase.from("series").select("*").eq("type", "novel").order("updated_at", { ascending: false }).limit(12),
          supabase.from("series").select("*").order("updated_at", { ascending: false }).limit(12),
          supabase.from("site_settings").select("site_name, seo_description").eq("id", true).maybeSingle(),
        ]);
        setTrending(t.data ?? []);
        setPopular(p.data ?? []);
        setNovels(n.data ?? []);

        if (settings.data && typeof document !== "undefined") {
          document.title = `${settings.data.site_name} — Read Manga & Novels Online`;
          const meta = document.querySelector('meta[name="description"]');
          if (meta) meta.setAttribute("content", settings.data.seo_description);
        }

        const seriesList = l.data ?? [];
        if (seriesList.length) {
          const ids = seriesList.map((s) => s.id);
          const { data: ch } = await supabase
            .from("chapters")
            .select("*")
            .in("series_id", ids)
            .order("number", { ascending: false });
          const byId = new Map<string, Chapter[]>();
          (ch ?? []).forEach((c) => {
            const arr = byId.get(c.series_id) ?? [];
            if (arr.length < 4) arr.push(c);
            byId.set(c.series_id, arr);
          });
          setLatest(seriesList.map((s) => ({ series: s, chapters: byId.get(s.id) ?? [] })));
        }
      } catch (err) {
        console.error("Failed to load homepage", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen pb-24 relative">
      <Hero items={trending} loading={loading} />
      <GenreBar />

      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 space-y-24 md:space-y-28 mt-16 md:mt-20 relative z-10">
        {loading ? (
          <section>
            <SectionHeader title="Loading" icon={<Sparkles className="h-4 w-4" />} />
            <SeriesCardSkeletonRow count={12} />
          </section>
        ) : (
          <>
            <LatestUpdatesSection items={latest} />
            <Section title="Top Rated Manga" icon={<Flame className="h-4 w-4" />} eyebrow="Reader Favorites" items={popular} />
            <Section title="Latest Novels" eyebrow="Fresh from the desk" items={novels} />
          </>
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  eyebrow,
  icon,
  href,
}: {
  title: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  href?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
      className="flex items-end justify-between mb-8 md:mb-10"
    >
      <div className="flex items-center gap-4">
        <span className="block h-8 w-[3px] rounded-full bg-aurora animate-glow-pulse" />
        <div>
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight inline-flex items-center gap-2.5 text-foreground">
            {icon && <span className="text-primary">{icon}</span>}
            {title}
          </h2>
        </div>
      </div>
      {href && (
        <Link to={href} className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary story-link transition-colors duration-300">
          View All →
        </Link>
      )}
    </motion.div>
  );
}

function LatestUpdatesSection({ items }: { items: LatestEntry[] }) {
  if (!items.length) return null;
  return (
    <section>
      <SectionHeader title="Latest Updates" eyebrow="Just dropped" href="/browse" />
      <motion.div
        variants={staggerContainer(0.06)}
        initial="initial"
        whileInView="enter"
        viewport={{ once: true, margin: "-60px" }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-7"
      >
        {items.map((entry) => (
          <motion.div key={entry.series.id} variants={staggerItem}>
            <LatestUpdateCard series={entry.series} chapters={entry.chapters} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function Section({
  title,
  eyebrow,
  icon,
  items,
}: {
  title: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  items: Series[];
}) {
  if (!items.length) return null;
  return (
    <section>
      <SectionHeader title={title} eyebrow={eyebrow} icon={icon} href="/browse" />
      <motion.div
        variants={staggerContainer(0.04)}
        initial="initial"
        whileInView="enter"
        viewport={{ once: true, margin: "-80px" }}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 md:gap-6"
      >
        {items.map((s) => (
          <motion.div key={s.id} variants={staggerItem}>
            <SeriesCard series={s} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* -------------------- HERO -------------------- */
function Hero({ items, loading }: { items: Series[]; loading?: boolean }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  // Parallax — image translates up slower than scroll
  const { scrollY } = useScroll();
  const yImg = useTransform(scrollY, [0, 600], [0, reduced ? 0 : -80]);
  const yText = useTransform(scrollY, [0, 600], [0, reduced ? 0 : -40]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0.45]);

  useEffect(() => {
    if (items.length < 2 || paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(id);
  }, [items.length, paused]);

  if (!items.length) {
    return (
      <div className="relative aspect-[21/9] w-full min-h-[420px] bg-gradient-to-br from-card to-muted/40 overflow-hidden">
        {loading && <div className="absolute inset-0 animate-pulse bg-muted/20" />}
      </div>
    );
  }

  const cur = items[idx];

  return (
    <section
      ref={heroRef}
      className="relative w-full aspect-[21/9] min-h-[520px] max-h-[88vh] overflow-hidden bg-black isolate"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Backdrops */}
      <motion.div className="absolute inset-0" style={{ y: yImg, opacity }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={cur.id}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1.04 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 1.2, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute inset-0"
          >
            <img
              src={resolveImage(cur.banner_url ?? cur.cover_url)}
              onError={onImageError}
              alt={cur.title}
              className="h-full w-full object-cover"
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-transparent" />
      </motion.div>

      {/* Aurora washes */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full blur-3xl opacity-30 mix-blend-screen animate-ambient"
        style={{ background: "var(--gradient-aurora)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-32 h-[420px] w-[420px] rounded-full blur-3xl opacity-20 mix-blend-screen animate-ambient"
        style={{ background: "var(--gradient-brand)", animationDelay: "2s" }}
        aria-hidden
      />

      {/* Content */}
      <motion.div
        style={{ y: yText }}
        className="container relative mx-auto h-full flex items-center px-4 md:px-8"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={cur.id}
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
            transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
            className="max-w-2xl"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary inline-flex items-center gap-2.5 mb-4">
              <span className="relative h-1.5 w-1.5 rounded-full bg-primary">
                <span className="absolute inset-0 rounded-full bg-primary animate-ping" />
              </span>
              Featured Series · {String(idx + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
            </div>
            <h1 className="font-bold tracking-tight text-white leading-[0.98] drop-shadow-[0_6px_30px_rgba(0,0,0,0.7)]
                           text-4xl md:text-6xl lg:text-7xl">
              <span className="wordmark not-italic font-bold">{cur.title}</span>
            </h1>
            {cur.author && (
              <p className="mt-4 text-xs md:text-sm font-medium uppercase tracking-[0.25em] text-white/65">
                by <span className="text-white/90">{cur.author}</span>
              </p>
            )}
            <p className="text-sm md:text-base font-normal text-white/80 line-clamp-3 max-w-xl mt-6 leading-relaxed">
              {cur.description}
            </p>
            <div className="flex items-center gap-3 pt-7">
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} transition={SPRING.snap}>
                <Button asChild size="lg" variant="premium" className="h-12 px-7 text-sm">
                  <Link to="/series/$slug" params={{ slug: cur.slug }}>
                    <Play className="h-4 w-4 fill-current" /> READ NOW
                  </Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} transition={SPRING.snap}>
                <Button asChild variant="outline" size="lg" className="focus-ring glass !bg-white/5 border-white/15 text-white hover:!bg-white/12 hover:text-white font-semibold rounded-full h-12 px-7 text-sm tracking-wider transition-all duration-300">
                  <Link to="/series/$slug" params={{ slug: cur.slug }}>+ MY LIST</Link>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Slide indicators */}
      {items.length > 1 && (
        <div className="absolute bottom-6 right-4 md:bottom-8 md:right-8 flex items-center gap-3 z-10">
          <div className="flex items-center gap-1.5 mr-1">
            {items.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ${i === idx ? "w-8 bg-primary shadow-[0_0_10px_var(--primary)]" : "w-1.5 bg-white/30 hover:bg-white/60"}`}
              />
            ))}
          </div>
          <button
            onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}
            className="focus-ring rounded-full glass p-2 text-white hover:bg-white/15 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % items.length)}
            className="focus-ring rounded-full glass p-2 text-white hover:bg-white/15 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Bottom fade-in to page */}
      <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-b from-transparent to-background pointer-events-none" />
    </section>
  );
}
