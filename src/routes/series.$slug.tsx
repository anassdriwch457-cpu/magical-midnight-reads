import { createFileRoute, Link, Outlet, notFound, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Lock, Coins, Eye, BookOpen } from "lucide-react";
import { resolveImage, onImageError } from "@/lib/image";

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
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  if (location.pathname.includes(`/series/${slug}/chapter/`)) {
    return <Outlet />;
  }

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("series").select("*").eq("slug", slug).maybeSingle();
      if (!s) { setNotFoundFlag(true); setLoading(false); return; }
      setSeries(s);
      const { data: ch } = await supabase.from("chapters").select("*").eq("series_id", s.id).order("number", { ascending: true });
      setChapters(ch ?? []);
      if (user) {
        const { data: u } = await supabase.from("chapter_unlocks").select("chapter_id").eq("user_id", user.id);
        setUnlocked(new Set((u ?? []).map(x => x.chapter_id)));
      }
      setLoading(false);
    })();
  }, [slug, user]);

  if (loading) return <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>;
  if (notFoundFlag || !series) throw notFound();

  return (
    <div>
      <div className="relative h-[40vh] min-h-[280px] overflow-hidden">
        <img src={series.banner_url ?? series.cover_url ?? ""} alt="" className="h-full w-full object-cover blur-sm scale-105 opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto px-4 -mt-32 relative">
        <div className="grid md:grid-cols-[220px_1fr] gap-8">
          <img src={series.cover_url ?? ""} alt={series.title} className="w-full max-w-[220px] aspect-[2/3] object-cover rounded-xl shadow-glow" />
          <div className="space-y-4 pt-4 md:pt-12">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-brand text-primary-foreground border-0 capitalize">{series.type}</Badge>
              <Badge variant="outline" className="capitalize">{series.status}</Badge>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-brand">{series.title}</h1>
            {series.author && <p className="text-sm text-muted-foreground">by {series.author}</p>}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> {series.views.toLocaleString()}</span>
              <span className="inline-flex items-center gap-1"><BookOpen className="h-4 w-4" /> {chapters.length} chapters</span>
            </div>
            <div className="flex flex-wrap gap-2">{series.genres.map(g => <Badge key={g} variant="secondary">{g}</Badge>)}</div>
            <p className="text-base leading-relaxed max-w-2xl">{series.description}</p>
          </div>
        </div>

        <section className="mt-12 pb-16">
          <h2 className="text-2xl font-bold mb-4">Chapters</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {chapters.map((c) => {
              const free = c.price === 0;
              const owned = unlocked.has(c.id);
              return (
                <Link
                  key={c.id}
                  to="/series/$slug/chapter/$number"
                  params={{ slug: series.slug, number: String(c.number) }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <div className="font-medium">Chapter {Number(c.number)}{c.title ? ` — ${c.title}` : ""}</div>
                    <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                  {free ? (
                    <Badge variant="outline" className="text-xs">Free</Badge>
                  ) : owned ? (
                    <Badge className="bg-accent text-accent-foreground border-0 text-xs">Unlocked</Badge>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-[var(--coin)]">
                      <Lock className="h-3.5 w-3.5" /> <Coins className="h-3.5 w-3.5" /> {c.price}
                    </span>
                  )}
                </Link>
              );
            })}
            {chapters.length === 0 && <div className="p-6 text-sm text-muted-foreground">No chapters yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
