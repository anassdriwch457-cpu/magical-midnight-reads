import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SeriesCard } from "@/components/series-card";
import { LatestUpdateCard } from "@/components/latest-update-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { GenreBar } from "@/components/genre-bar";
import { resolveImage, onImageError } from "@/lib/image";

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

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  return (
    <div className="min-h-screen pb-20">
      <Hero items={trending} />
      <GenreBar />
      <div className="container mx-auto px-4 space-y-14 mt-10">
        <LatestUpdatesSection items={latest} />
        <Section title="Top Rated Manga" items={popular} />
        <Section title="Latest Novels" items={novels} />
      </div>
    </div>
  );
}

function LatestUpdatesSection({ items }: { items: LatestEntry[] }) {
  if (!items.length) return null;
  return (
    <section>
      <div className="flex items-end justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="block h-6 w-1 bg-primary rounded-sm" />
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight uppercase">Latest Updates</h2>
        </div>
        <Link to="/browse" className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">
          View All →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((entry) => (
          <LatestUpdateCard key={entry.series.id} series={entry.series} chapters={entry.chapters} />
        ))}
      </div>
    </section>
  );
}

function Hero({ items }: { items: Series[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(id);
  }, [items.length]);

  if (!items.length) {
    return <div className="aspect-[21/9] w-full bg-card" />;
  }

  const cur = items[idx];
  return (
    <section className="relative w-full aspect-[21/9] min-h-[420px] max-h-[80vh] overflow-hidden bg-black">
      {items.map((s, i) => (
        <div key={s.id} className={`absolute inset-0 transition-opacity duration-1000 ${i === idx ? "opacity-100" : "opacity-0"}`}>
          {(s.banner_url || s.cover_url) && (
            <img
              src={s.banner_url ?? s.cover_url ?? ""}
              alt={s.title}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        </div>
      ))}

      <div className="container relative mx-auto h-full flex items-center px-4 md:px-8">
        <div className="max-w-xl space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">
            ● Featured Series
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.05]">
            {cur.title}
          </h1>
          <p className="text-sm md:text-base text-white/75 line-clamp-3 max-w-lg">
            {cur.description}
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-[4px] h-11 px-6">
              <Link to="/series/$slug" params={{ slug: cur.slug }}>
                <Play className="h-4 w-4 fill-current" /> READ NOW
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white font-bold rounded-[4px] h-11 px-6">
              <Link to="/series/$slug" params={{ slug: cur.slug }}>+ MY LIST</Link>
            </Button>
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-8 flex items-center gap-2 z-10">
          <button onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)} className="rounded-full bg-black/50 hover:bg-black/70 backdrop-blur p-2 text-white"><ChevronLeft className="h-4 w-4" /></button>
          <span className="tabular-nums text-xs text-white/80 bg-black/50 px-2.5 py-1 rounded">{idx + 1} / {items.length}</span>
          <button onClick={() => setIdx((i) => (i + 1) % items.length)} className="rounded-full bg-black/50 hover:bg-black/70 backdrop-blur p-2 text-white"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </section>
  );
}

function Section({ title, items }: { title: string; items: Series[] }) {
  if (!items.length) return null;
  return (
    <section>
      <div className="flex items-end justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="block h-6 w-1 bg-primary rounded-sm" />
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight uppercase">{title}</h2>
        </div>
        <Link to="/browse" className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">
          View All →
        </Link>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-6">
        {items.map((s) => <SeriesCard key={s.id} series={s} />)}
      </div>
    </section>
  );
}
