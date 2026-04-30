import { createFileRoute, Link, Outlet, notFound, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { Lock, Coins, Eye, BookOpen, Check, Play, Star, Bookmark, ListOrdered } from "lucide-react";
import { resolveImage, onImageError } from "@/lib/image";
import { GenreTag } from "@/components/genre-tag";
import { BigRecCard } from "@/components/big-rec-card";
import { Button } from "@/components/ui/button";

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

  if (location.pathname.includes(`/series/${slug}/chapter/`)) {
    return <Outlet />;
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: s } = await supabase.from("series").select("*").eq("slug", slug).maybeSingle();
      if (!s) { setNotFoundFlag(true); setLoading(false); return; }
      setSeries(s);

      const [chRes, relRes, unlocksRes] = await Promise.all([
        supabase.from("chapters").select("*").eq("series_id", s.id).order("number", { ascending: true }),
        supabase.from("series").select("*")
          .neq("id", s.id)
          .eq("type", s.type)
          .order("views", { ascending: false })
          .limit(6),
        user
          ? supabase.from("chapter_unlocks").select("chapter_id").eq("user_id", user.id)
          : Promise.resolve({ data: [] as { chapter_id: string }[] }),
      ]);

      setChapters(chRes.data ?? []);

      // Pick related by overlapping genres if possible, else fall back to same-type popular
      let rel = relRes.data ?? [];
      if (s.genres?.length) {
        const overlap = rel.filter((r) => r.genres?.some((g) => s.genres.includes(g)));
        if (overlap.length >= 3) rel = overlap;
      }
      setRelated(rel.slice(0, 6));

      setUnlocked(new Set((unlocksRes.data ?? []).map((x) => x.chapter_id)));
      setLoading(false);
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
  const firstUnreadOrFirst = chapters.find((c) => c.price === 0 || unlocked.has(c.id)) ?? chapters[0];

  return (
    <div className="pb-20">
      {/* CINEMATIC HERO */}
      <div className="relative w-full min-h-[420px] md:min-h-[520px] overflow-hidden">
        <img
          src={resolveImage(series.banner_url ?? series.cover_url)}
          onError={onImageError}
          alt=""
          className="absolute inset-0 h-full w-full object-cover scale-105 blur-[2px] opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
        <div
          className="pointer-events-none absolute -top-24 -left-24 h-[460px] w-[460px] rounded-full blur-3xl opacity-40 mix-blend-screen animate-ambient"
          style={{ background: "var(--gradient-aurora)" }}
          aria-hidden
        />

        <div className="container relative mx-auto px-4 pt-28 md:pt-36">
          <div className="grid md:grid-cols-[240px_1fr] gap-8 items-end">
            <div className="relative mx-auto md:mx-0 w-[200px] md:w-[240px] aspect-[2/3] rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-elev animate-scale-in">
              <img
                src={resolveImage(series.cover_url)}
                onError={onImageError}
                alt={series.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
            </div>

            <div className="space-y-4 stagger pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-aurora text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 capitalize">{series.type}</span>
                <span className="rounded-full glass text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 capitalize text-white/85">{series.status}</span>
                {series.is_trending && <span className="rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 inline-flex items-center gap-1"><Star className="h-3 w-3" /> Trending</span>}
              </div>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
                <span className="text-aurora">{series.title}</span>
              </h1>
              {series.author && <p className="text-sm text-muted-foreground">by <span className="font-semibold text-foreground/90">{series.author}</span></p>}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Eye className="h-4 w-4" /> {series.views.toLocaleString()}</span>
                <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {chapters.length} chapters</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {series.genres.map((g) => <GenreTag key={g} name={g} size="sm" />)}
              </div>
              <p className="text-sm md:text-base leading-relaxed max-w-2xl text-foreground/85">{series.description}</p>

              <div className="flex flex-wrap gap-3 pt-2">
                {firstUnreadOrFirst && (
                  <Button asChild size="lg" className="haptic bg-aurora text-white border-0 hover:opacity-95 font-bold rounded-full h-11 px-6 shadow-glow">
                    <Link to="/series/$slug/chapter/$number" params={{ slug: series.slug, number: String(firstUnreadOrFirst.number) }}>
                      <Play className="h-4 w-4 fill-current" /> START READING
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="lg" className="haptic glass !bg-white/5 border-white/15 text-white hover:!bg-white/15 font-bold rounded-full h-11 px-6">
                  <Bookmark className="h-4 w-4" /> ADD TO LIST
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CHAPTERS */}
      <section className="container mx-auto px-4 mt-12">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="block h-6 w-1 bg-aurora rounded-sm" />
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight uppercase inline-flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" /> Chapters
            </h2>
          </div>
          <button
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            className="haptic text-[11px] font-bold uppercase tracking-wider rounded-full glass px-3 py-1.5 text-white/85"
          >
            {order === "asc" ? "Oldest first" : "Newest first"}
          </button>
        </div>

        <div className="rounded-2xl glass-card overflow-hidden divide-y divide-white/5">
          {sortedChapters.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">No chapters yet.</div>
          )}
          {sortedChapters.map((c) => {
            const free = c.price === 0;
            const owned = unlocked.has(c.id);
            return (
              <Link
                key={c.id}
                to="/series/$slug/chapter/$number"
                params={{ slug: series.slug, number: String(c.number) }}
                className="group flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    Chapter {Number(c.number)}{c.title ? <span className="font-normal text-muted-foreground"> · {c.title}</span> : ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{new Date(c.created_at).toLocaleDateString()}</div>
                </div>
                {free ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/90">Free</span>
                ) : owned ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    <Check className="h-3 w-3" /> Unlocked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--coin)]">
                    <Lock className="h-3.5 w-3.5" /> <Coins className="h-3.5 w-3.5" /> {c.price}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* MORE LIKE THIS */}
      {related.length > 0 && (
        <section className="container mx-auto px-4 mt-16">
          <div className="flex items-end justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="block h-6 w-1 bg-aurora rounded-sm" />
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight uppercase">More Like This</h2>
            </div>
            <Link to="/browse" className="story-link text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">View All</Link>
          </div>
          <div className="stagger grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 md:gap-5">
            {related.map((r) => <BigRecCard key={r.id} series={r} />)}
          </div>
        </section>
      )}
    </div>
  );
}
