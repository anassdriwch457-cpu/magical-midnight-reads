import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Lock, Coins, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Chapter = Tables<"chapters">;
type Page = Tables<"chapter_pages">;
type Series = Tables<"series">;

export const Route = createFileRoute("/series/$slug/chapter/$number")({
  component: ReaderPage,
});

function ReaderPage() {
  const { slug, number } = Route.useParams();
  const { user, wallet, refreshWallet } = useAuth();
  const navigate = useNavigate();

  const [series, setSeries] = useState<Series | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [siblings, setSiblings] = useState<{ prev?: number; next?: number }>({});
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: s } = await supabase.from("series").select("*").eq("slug", slug).maybeSingle();
    if (!s) { setLoading(false); return; }
    setSeries(s);
    const { data: c } = await supabase.from("chapters").select("*").eq("series_id", s.id).eq("number", Number(number)).maybeSingle();
    if (!c) { setLoading(false); return; }
    setChapter(c);

    const { data: all } = await supabase.from("chapters").select("number").eq("series_id", s.id).order("number", { ascending: true });
    const nums = (all ?? []).map(x => Number(x.number));
    const idx = nums.indexOf(Number(c.number));
    setSiblings({ prev: idx > 0 ? nums[idx - 1] : undefined, next: idx >= 0 && idx < nums.length - 1 ? nums[idx + 1] : undefined });

    let access = c.price === 0;
    if (!access && user) {
      const { data: u } = await supabase.from("chapter_unlocks").select("id").eq("user_id", user.id).eq("chapter_id", c.id).maybeSingle();
      access = !!u;
    }
    setUnlocked(access);

    if (access && s.type === "manga") {
      const { data: p } = await supabase.from("chapter_pages").select("*").eq("chapter_id", c.id).order("page_number", { ascending: true });
      setPages(p ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug, number, user?.id]);

  const handleUnlock = async () => {
    if (!user) { navigate({ to: "/auth" }); return; }
    if (!chapter) return;
    setUnlocking(true);
    const { data, error } = await supabase.rpc("unlock_chapter", { _chapter_id: chapter.id });
    setUnlocking(false);
    if (error) { toast.error(error.message); return; }
    const r = data as { success: boolean; error?: string; balance?: number };
    if (!r.success) {
      if (r.error === "Insufficient coins") { toast.error("Not enough coins. Top up to continue."); navigate({ to: "/topup" }); }
      else toast.error(r.error ?? "Failed to unlock");
      return;
    }
    toast.success("Chapter unlocked!");
    await refreshWallet();
    await load();
  };

  if (loading) return <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>;
  if (!series || !chapter) return <div className="container mx-auto px-4 py-20 text-center">Chapter not found.</div>;

  const Nav = () => (
    <div className="flex items-center justify-between gap-2 my-6">
      {siblings.prev !== undefined ? (
        <Button asChild variant="outline"><Link to="/series/$slug/chapter/$number" params={{ slug, number: String(siblings.prev) }}><ChevronLeft className="h-4 w-4 mr-1" /> Previous</Link></Button>
      ) : <div />}
      <Button asChild variant="ghost"><Link to="/series/$slug" params={{ slug }}>All chapters</Link></Button>
      {siblings.next !== undefined ? (
        <Button asChild variant="outline"><Link to="/series/$slug/chapter/$number" params={{ slug, number: String(siblings.next) }}>Next <ChevronRight className="h-4 w-4 ml-1" /></Link></Button>
      ) : <div />}
    </div>
  );

  if (!unlocked) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <div className="rounded-2xl border border-border bg-card p-10 shadow-card">
          <Lock className="mx-auto h-12 w-12 text-primary mb-3" />
          <h1 className="text-2xl font-bold">Chapter {Number(chapter.number)} is locked</h1>
          <p className="text-muted-foreground mt-1">{series.title}</p>
          <div className="my-6 inline-flex items-center gap-2 text-2xl font-bold">
            <Coins className="h-6 w-6 text-[var(--coin)]" /> {chapter.price}
          </div>
          {user && <p className="text-sm text-muted-foreground mb-4">Your balance: <span className="font-semibold text-foreground tabular-nums">{wallet?.coins ?? 0}</span></p>}
          <Button onClick={handleUnlock} disabled={unlocking} className="w-full bg-brand text-primary-foreground border-0 shadow-glow">
            {unlocking ? "Unlocking…" : user ? "Unlock chapter" : "Sign in to unlock"}
          </Button>
          <Button asChild variant="ghost" className="w-full mt-2"><Link to="/topup">Need more coins? Top up →</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <div className="mb-2"><Link to="/series/$slug" params={{ slug }} className="text-sm text-muted-foreground hover:text-primary">← {series.title}</Link></div>
      <h1 className="text-2xl font-bold mb-2">Chapter {Number(chapter.number)}{chapter.title ? ` — ${chapter.title}` : ""}</h1>
      <Nav />
      {series.type === "manga" ? (
        <div className="space-y-1 bg-black/20 rounded-lg overflow-hidden">
          {pages.length === 0 ? <p className="text-center py-12 text-muted-foreground">No pages uploaded.</p> :
            pages.map(p => <img key={p.id} src={p.image_url} alt={`Page ${p.page_number}`} loading="lazy" className="w-full block" />)
          }
        </div>
      ) : (
        <article className="prose prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-base">
          {chapter.content || "No content."}
        </article>
      )}
      <Nav />
    </div>
  );
}
