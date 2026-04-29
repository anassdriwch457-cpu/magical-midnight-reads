import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SeriesCard } from "@/components/series-card";
import { Button } from "@/components/ui/button";
import { GenreBar } from "@/components/genre-bar";

type Series = Tables<"series">;
const PAGE_SIZE = 18;
const GENRES = ["All", "Action", "Fantasy", "Romance", "Adventure", "Magic", "Drama", "Mystery", "Supernatural", "School Life"];
const TYPES = [{ k: "all", l: "All" }, { k: "manga", l: "Manga" }, { k: "novel", l: "Novel" }] as const;
const STATUSES = [{ k: "all", l: "All" }, { k: "ongoing", l: "Ongoing" }, { k: "completed", l: "Completed" }, { k: "hiatus", l: "Hiatus" }] as const;
const SORTS = [{ k: "latest", l: "Latest" }, { k: "popular", l: "Popular" }, { k: "title", l: "A–Z" }] as const;

export const Route = createFileRoute("/browse")({
  component: BrowsePage,
  head: () => ({
    meta: [
      { title: "Browse — Nuvia Toon" },
      { name: "description", content: "Browse manga and novels by type, status, and genre." },
    ],
  }),
});

function BrowsePage() {
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [genre, setGenre] = useState<string>("All");
  const [sort, setSort] = useState<string>("latest");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Series[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("series").select("*", { count: "exact" });
      if (type !== "all") q = q.eq("type", type as "manga" | "novel");
      if (status !== "all") q = q.eq("status", status as "ongoing" | "completed" | "hiatus");
      if (genre !== "All") q = q.contains("genres", [genre]);
      if (sort === "latest") q = q.order("created_at", { ascending: false });
      else if (sort === "popular") q = q.order("views", { ascending: false });
      else if (sort === "title") q = q.order("title", { ascending: true });
      const from = page * PAGE_SIZE;
      const { data, count: c } = await q.range(from, from + PAGE_SIZE - 1);
      setItems(data ?? []);
      setCount(c ?? 0);
      setLoading(false);
    })();
  }, [type, status, genre, sort, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / PAGE_SIZE)), [count]);
  const reset = (fn: () => void) => { fn(); setPage(0); };

  return (
    <div className="pb-16 pt-16">
      <GenreBar />
      <div className="container mx-auto px-4 pt-8">
        <div className="flex items-end justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="block h-6 w-1 bg-primary rounded-sm" />
            <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight">Browse</h1>
          </div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{count} results</p>
        </div>

        <div className="space-y-4 mb-8">
          <TabRow label="Type" options={TYPES} value={type} onChange={(v) => reset(() => setType(v))} />
          <TabRow label="Genre" options={GENRES.map(g => ({ k: g, l: g }))} value={genre} onChange={(v) => reset(() => setGenre(v))} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TabRow label="Status" options={STATUSES} value={status} onChange={(v) => reset(() => setStatus(v))} />
            <TabRow label="Sort" options={SORTS} value={sort} onChange={(v) => reset(() => setSort(v))} />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-6">
            {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[2/3] rounded-[4px] bg-muted animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No series match your filters.</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-6">
            {items.map(s => <SeriesCard key={s.id} series={s} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-12">
            <Button variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="rounded-[4px]">Previous</Button>
            <span className="text-sm tabular-nums px-4 text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-[4px]">Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TabRow({ label, options, value, onChange }: { label: string; options: readonly { k: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {options.map((o) => (
          <button
            key={o.k}
            onClick={() => onChange(o.k)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-[4px] transition-colors ${
              value === o.k
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-card"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
