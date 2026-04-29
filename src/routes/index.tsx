import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SeriesCard } from "@/components/series-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { GenreBar } from "@/components/genre-bar";

type Series = Tables<"series">;

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Nuvia Toon — Magical Manhwa & Novels" },
      { name: "description", content: "Trending manhwa, popular reads, and the newest novel updates — all in one magical hub." },
    ],
  }),
});

function HomePage() {
  const [trending, setTrending] = useState<Series[]>([]);
  const [popular, setPopular] = useState<Series[]>([]);
  const [novels, setNovels] = useState<Series[]>([]);
  const [latest, setLatest] = useState<Series[]>([]);

  useEffect(() => {
    (async () => {
      const [t, p, n, l] = await Promise.all([
        supabase.from("series").select("*").eq("is_trending", true).limit(5),
        supabase.from("series").select("*").eq("is_popular", true).eq("type", "manga").limit(12),
        supabase.from("series").select("*").eq("type", "novel").order("updated_at", { ascending: false }).limit(12),
        supabase.from("series").select("*").order("created_at", { ascending: false }).limit(12),
      ]);
      setTrending(t.data ?? []);
      setPopular(p.data ?? []);
      setNovels(n.data ?? []);
      setLatest(l.data ?? []);
    })();
  }, []);

  return (
    <div className="min-h-screen pb-16">
      <Hero items={trending} />
      <GenreBar />
      <div className="container mx-auto px-4 space-y-12 mt-4">
        <Section title="Popular Manga" items={popular} />
        <Section title="Latest Novel Updates" items={novels} />
        <Section title="New Arrivals" items={latest} />
      </div>
    </div>
  );
}

function Hero({ items }: { items: Series[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), 5000);
    return () => clearInterval(id);
  }, [items.length]);

  if (!items.length) {
    return (
      <div className="relative h-[60vh] flex items-center justify-center bg-card">
        <div className="text-center space-y-3">
          <Sparkles className="mx-auto h-10 w-10 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading magical worlds…</p>
        </div>
      </div>
    );
  }

  const cur = items[idx];
  return (
    <section className="relative h-[70vh] min-h-[460px] overflow-hidden">
      {items.map((s, i) => (
        <div key={s.id} className={`absolute inset-0 transition-opacity duration-1000 ${i === idx ? "opacity-100" : "opacity-0"}`}>
          {(s.banner_url || s.cover_url) && (
            <img src={s.banner_url ?? s.cover_url ?? ""} alt={s.title} className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        </div>
      ))}
      <div className="container relative mx-auto h-full flex items-end pb-16 px-4">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" /> Trending Now
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-brand">{cur.title}</h1>
          <p className="text-base md:text-lg text-muted-foreground line-clamp-3">{cur.description}</p>
          <div className="flex items-center gap-3">
            <Button asChild size="lg" className="bg-brand text-primary-foreground border-0 shadow-glow">
              <Link to="/series/$slug" params={{ slug: cur.slug }}>Read Now</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/browse">Browse All</Link>
            </Button>
          </div>
        </div>
      </div>
      <div className="absolute bottom-6 right-6 flex items-center gap-2 z-10">
        <Button size="icon" variant="ghost" className="rounded-full bg-card/60 backdrop-blur" onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="tabular-nums text-xs text-muted-foreground bg-card/60 px-2 py-1 rounded">{idx + 1} / {items.length}</span>
        <Button size="icon" variant="ghost" className="rounded-full bg-card/60 backdrop-blur" onClick={() => setIdx((i) => (i + 1) % items.length)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </section>
  );
}

function Section({ title, items }: { title: string; items: Series[] }) {
  if (!items.length) return null;
  return (
    <section>
      <div className="flex items-end justify-between mb-4">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <Link to="/browse" className="text-sm text-primary hover:underline">See all →</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((s) => <SeriesCard key={s.id} series={s} />)}
      </div>
    </section>
  );
}
