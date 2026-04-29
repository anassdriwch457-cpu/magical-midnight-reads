import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SeriesCard } from "@/components/series-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Series = Tables<"series">;
const PAGE_SIZE = 18;
const GENRES = ["All","Action","Fantasy","Romance","Adventure","Magic","Drama","Mystery","Supernatural","School Life"];

export const Route = createFileRoute("/browse")({
  component: BrowsePage,
  head: () => ({
    meta: [
      { title: "Browse — Nuvia Toon" },
      { name: "description", content: "Browse manhwa and novels by type, status, genre, and popularity." },
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
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Browse</h1>
      <p className="text-muted-foreground mb-6">{count} series found</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Select value={type} onValueChange={(v) => reset(() => setType(v))}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="manga">Manga / Manhwa</SelectItem>
            <SelectItem value="novel">Novel</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => reset(() => setStatus(v))}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ongoing">Ongoing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="hiatus">Hiatus</SelectItem>
          </SelectContent>
        </Select>
        <Select value={genre} onValueChange={(v) => reset(() => setGenre(v))}>
          <SelectTrigger><SelectValue placeholder="Genre" /></SelectTrigger>
          <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => reset(() => setSort(v))}>
          <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest</SelectItem>
            <SelectItem value="popular">Most Popular</SelectItem>
            <SelectItem value="title">Title (A–Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[2/3] rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No series match your filters.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map(s => <SeriesCard key={s.id} series={s} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-10">
          <Button variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
          <span className="text-sm tabular-nums px-4">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
        </div>
      )}
    </div>
  );
}
