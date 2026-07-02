import { createFileRoute, Link, Outlet, notFound, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import {
  Lock,
  Coins,
  Eye,
  BookOpen,
  Check,
  Play,
  Star,
  Bookmark,
  ListOrdered,
  Clock,
  ArrowUpDown,
} from "lucide-react";
import { resolveImage, onImageError } from "@/lib/image";
import { GenreTag } from "@/components/genre-tag";
import { BigRecCard } from "@/components/big-rec-card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, SPRING, staggerContainer, staggerItem } from "@/lib/motion";
import { useScroll, useTransform, useReducedMotion } from "framer-motion";

type Series = Tables<"series">;
type Chapter = Tables<"chapters">;

export const Route = createFileRoute("/series/$slug")({
  component: SeriesDetail,
});

function SeriesDetail() {
  const { slug } = Route.useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [series, setSeries] = useState<Series | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [related, setRelated] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const yBg = useTransform(scrollY, [0, 600], [0, reduced ? 0 : -120]);
  const opacityBg = useTransform(scrollY, [0, 500], [0.5, 0.15]);

  if (location.pathname.includes(`/series/${slug}/chapter/`)) {
    return <Outlet />;
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: s, error: seriesErr } = await supabase
          .from("series")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();
        if (seriesErr) {
          console.error("[series] failed to fetch series", seriesErr);
          setNotFoundFlag(true);
          setLoading(false);
          return;
        }
        if (!s) {
          setNotFoundFlag(true);
          setLoading(false);
          return;
        }
        setSeries(s);

        const [chRes, relRes, unlocksRes] = await Promise.all([
          supabase
            .from("chapters")
            .select("*")
            .eq("series_id", s.id)
            .order("number", { ascending: true }),
          supabase
            .from("series")
            .select("*")
            .neq("id", s.id)
            .eq("type", s.type)
            .order("views", { ascending: false })
            .limit(6),
          user
            ? supabase.from("chapter_unlocks").select("chapter_id").eq("user_id", user.id)
            : Promise.resolve({ data: [] as { chapter_id: string }[], error: null }),
        ]);

        if (chRes.error) console.error("[series] failed to fetch chapters", chRes.error);
        if (relRes.error) console.error("[series] failed to fetch related series", relRes.error);
        if (unlocksRes.error) console.error("[series] failed to fetch unlocks", unlocksRes.error);

        setChapters(chRes.data ?? []);

        let rel = relRes.data ?? [];
        if (s.genres?.length) {
          const overlap = rel.filter((r) => r.genres?.some((g) => s.genres.includes(g)));
          if (overlap.length >= 3) rel = overlap;
        }
        setRelated(rel.slice(0, 6));

        setUnlocked(new Set((unlocksRes.data ?? []).map((x) => x.chapter_id)));
      } catch (err) {
        console.error("[series] unexpected error loading series page", err);
        setNotFoundFlag(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, user]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <div className="inline-flex items-center gap-3 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Loading…
        </div>
      </div>
    );
  }
  if (notFoundFlag || !series) throw notFound();

  const sortedChapters = order === "asc" ? chapters : [...chapters].reverse();
  const firstUnreadOrFirst =
    chapters.find((c) => c.price === 0 || unlocked.has(c.id)) ?? chapters[0];
  const totalCoins = chapters.reduce(
    (sum, c) => sum + (unlocked.has(c.id) ? 0 : (c.price ?? 0)),
    0,
  );

  return (
    <div className="pb-24">
      {/* CINEMATIC HERO */}
      <div className="relative w-full min-h-[460px] md:min-h-[560px] overflow-hidden">
        <motion.div className="absolute inset-0" style={{ y: yBg, opacity: opacityBg }}>
          <img
            src={resolveImage(series.banner_url ?? series.cover_url)}
            onError={onImageError}
            alt=""
            className="absolute inset-0 h-full w-full object-cover scale-110 blur-[3px]"
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/65 to-background" />
        <div
          className="pointer-events-none absolute -top-24 -left-24 h-[460px] w-[460px] rounded-full blur-3xl opacity-40 mix-blend-screen animate-ambient"
          style={{ background: "var(--gradient-aurora)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-24 h-[420px] w-[420px] rounded-full blur-3xl opacity-25 mix-blend-screen animate-ambient"
          style={{ background: "var(--gradient-brand)", animationDelay: "1.5s" }}
          aria-hidden
        />

        <div className="container relative mx-auto px-4 pt-28 md:pt-36">
          <div className="grid md:grid-cols-[260px_1fr] gap-8 items-end">
            {/* Cover */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={SPRING.soft}
              className="relative mx-auto md:mx-0 w-[210px] md:w-[260px] aspect-[2/3] rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-elev gradient-stroke"
            >
              <img
                src={resolveImage(series.cover_url)}
                onError={onImageError}
                alt={series.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
            </motion.div>

            {/* Meta */}
            <motion.div
              variants={staggerContainer(0.06)}
              initial="initial"
              animate="enter"
              className="space-y-4 pb-2"
            >
              <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-aurora text-white text-[10px] font-extrabold uppercase tracking-[0.2em] px-2.5 py-0.5 capitalize">
                  {series.type}
                </span>
                <span className="rounded-full glass text-[10px] font-bold uppercase tracking-[0.2em] px-2.5 py-0.5 capitalize text-white/85">
                  {series.status}
                </span>
                {series.is_trending && (
                  <span className="rounded-full bg-primary/20 text-primary text-[10px] font-extrabold uppercase tracking-[0.2em] px-2.5 py-0.5 inline-flex items-center gap-1 ring-1 ring-primary/30">
                    <Star className="h-3 w-3 fill-current" /> Trending
                  </span>
                )}
              </motion.div>
              <motion.h1
                variants={staggerItem}
                className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.02]"
              >
                <span className="wordmark not-italic font-extrabold text-aurora">
                  {series.title}
                </span>
              </motion.h1>
              {series.author && (
                <motion.p variants={staggerItem} className="text-sm text-muted-foreground">
                  by <span className="font-semibold text-foreground/90">{series.author}</span>
                </motion.p>
              )}
              <motion.div
                variants={staggerItem}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />{" "}
                  <span className="font-mono">{series.views.toLocaleString()}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" />{" "}
                  <span className="font-mono">{chapters.length}</span> chapters
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Updated{" "}
                  {new Date(series.updated_at).toLocaleDateString()}
                </span>
              </motion.div>
              <motion.div variants={staggerItem} className="flex flex-wrap gap-1.5">
                {series.genres.map((g) => (
                  <GenreTag key={g} name={g} size="sm" />
                ))}
              </motion.div>
              <motion.p
                variants={staggerItem}
                className="text-sm md:text-base leading-relaxed max-w-2xl text-foreground/85"
              >
                {series.description}
              </motion.p>

              <motion.div variants={staggerItem} className="flex flex-wrap gap-3 pt-3">
                {firstUnreadOrFirst && (
                  <motion.div
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    transition={SPRING.snap}
                  >
                    <Button asChild size="lg" variant="premium" className="h-12 px-7 text-sm">
                      <Link
                        to="/series/$slug/chapter/$number"
                        params={{ slug: series.slug, number: String(firstUnreadOrFirst.number) }}
                      >
                        <Play className="h-4 w-4 fill-current" /> START READING
                      </Link>
                    </Button>
                  </motion.div>
                )}
                <motion.div
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING.snap}
                >
                  <Button
                    variant="outline"
                    size="lg"
                    className="focus-ring glass !bg-white/5 border-white/20 text-white hover:!bg-white/15 font-extrabold rounded-full h-12 px-7 tracking-wider"
                  >
                    <Bookmark className="h-4 w-4" /> ADD TO LIST
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* CHAPTERS */}
      <section className="container mx-auto px-4 mt-14 relative z-10">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="block h-7 w-1 bg-aurora rounded-full animate-glow-pulse shrink-0" />
            <div className="min-w-0">
              <div className="eyebrow mb-0.5">Chapter list</div>
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight uppercase inline-flex items-center gap-2">
                <ListOrdered className="h-5 w-5 text-primary" /> {chapters.length} Chapters
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalCoins > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full glass text-[11px] font-extrabold tracking-wider px-3 py-1.5 text-[var(--coin)] ring-1 ring-amber-300/20">
                <Coins className="h-3.5 w-3.5" /> {totalCoins} to unlock all
              </span>
            )}
            <button
              onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
              className="focus-ring text-[11px] font-extrabold uppercase tracking-[0.18em] rounded-full glass px-3 py-1.5 text-white/85 inline-flex items-center gap-1.5 hover:bg-white/15 transition-colors"
            >
              <ArrowUpDown className="h-3 w-3" />
              {order === "asc" ? "Oldest" : "Newest"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl glass-card overflow-hidden divide-y divide-white/5 inner-highlight">
          {sortedChapters.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">No chapters yet.</div>
          )}
          <AnimatePresence initial={false}>
            {sortedChapters.map((c, i) => {
              const free = c.price === 0;
              const owned = unlocked.has(c.id);
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, x: order === "asc" ? -8 : 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.015 }}
                >
                  <Link
                    to="/series/$slug/chapter/$number"
                    params={{ slug: series.slug, number: String(c.number) }}
                    className="group flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`grid place-items-center h-8 w-8 rounded-lg shrink-0 text-[10px] font-extrabold tabular-nums tracking-tight transition-all ${
                          owned
                            ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
                            : free
                              ? "bg-white/8 text-white/85 ring-1 ring-white/10"
                              : "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/25"
                        }`}
                      >
                        {Number(c.number)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                          Chapter {Number(c.number)}
                          {c.title ? (
                            <span className="font-normal text-muted-foreground"> · {c.title}</span>
                          ) : (
                            ""
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                          {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    {free ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-300/90">
                        Free
                      </span>
                    ) : owned ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-300">
                        <Check className="h-3 w-3" /> Unlocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--coin)]">
                        <Lock className="h-3.5 w-3.5" /> <Coins className="h-3.5 w-3.5" /> {c.price}
                      </span>
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      {/* MORE LIKE THIS */}
      {related.length > 0 && (
        <section className="container mx-auto px-4 mt-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="flex items-end justify-between mb-6"
          >
            <div className="flex items-center gap-3.5">
              <span className="block h-7 w-1 bg-aurora rounded-full animate-glow-pulse" />
              <div>
                <div className="eyebrow mb-0.5">You may also love</div>
                <h2 className="text-xl md:text-2xl font-extrabold tracking-tight uppercase">
                  More Like This
                </h2>
              </div>
            </div>
            <Link
              to="/browse"
              className="story-link text-xs font-extrabold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
            >
              View All
            </Link>
          </motion.div>
          <motion.div
            variants={staggerContainer(0.06)}
            initial="initial"
            whileInView="enter"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 md:gap-5"
          >
            {related.map((r) => (
              <motion.div key={r.id} variants={staggerItem}>
                <BigRecCard series={r} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* MOBILE STICKY CTA */}
      {firstUnreadOrFirst && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={SPRING.soft}
          className="md:hidden fixed bottom-16 inset-x-0 z-30 px-3"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="glass-strong rounded-full p-2 flex items-center gap-2 shadow-elev">
            <Link
              to="/series/$slug/chapter/$number"
              params={{ slug: series.slug, number: String(firstUnreadOrFirst.number) }}
              className="focus-ring flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-full bg-aurora text-white font-extrabold text-sm tracking-wider shadow-glow"
            >
              <Play className="h-4 w-4 fill-current" /> START READING
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
