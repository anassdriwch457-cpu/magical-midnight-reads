import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Coins, Lock } from "lucide-react";
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
  const [allChapters, setAllChapters] = useState<number[]>([]);
  const [siblings, setSiblings] = useState<{ prev?: number; next?: number }>({});
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [showUI, setShowUI] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMessage(null);
    setDebugMessage(null);
    setPages([]);
    setPagesLoading(false);

    try {
      const { data: s, error: seriesError } = await supabase
        .from("series")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (seriesError) throw seriesError;
      if (!s) {
        setSeries(null);
        setChapter(null);
        setDebugMessage(`Debug: Series slug "${slug}" was reached, but no series was found.`);
        return;
      }

      setSeries(s);

      const { data: chapterRows, error: chaptersError } = await supabase
        .from("chapters")
        .select("*")
        .eq("series_id", s.id)
        .order("number", { ascending: true });

      if (chaptersError) throw chaptersError;

      const allRows = chapterRows ?? [];
      const nums = allRows.map((item) => Number(item.number));
      setAllChapters(nums);

      const currentChapter = allRows.find((item) => Number(item.number) === Number(number)) ?? null;
      if (!currentChapter) {
        setChapter(null);
        setSiblings({});
        setUnlocked(false);
        setDebugMessage(`Debug: Series "${s.title}" loaded, but chapter number ${number} was not found.`);
        return;
      }

      setChapter(currentChapter);

      const idx = nums.indexOf(Number(currentChapter.number));
      setSiblings({
        prev: idx > 0 ? nums[idx - 1] : undefined,
        next: idx >= 0 && idx < nums.length - 1 ? nums[idx + 1] : undefined,
      });

      let access = currentChapter.price === 0;
      if (!access && user) {
        const { data: unlockedRow, error: unlockError } = await supabase
          .from("chapter_unlocks")
          .select("id")
          .eq("user_id", user.id)
          .eq("chapter_id", currentChapter.id)
          .maybeSingle();

        if (unlockError) throw unlockError;
        access = !!unlockedRow;
      }

      setUnlocked(access);

      if (s.type === "manga" && access) {
        setLoading(false);
        setPagesLoading(true);
        const { data: pageRows, error: pagesError } = await supabase
          .from("chapter_pages")
          .select("*")
          .eq("chapter_id", currentChapter.id)
          .order("page_number", { ascending: true });

        if (pagesError) throw pagesError;

        const loadedPages = pageRows ?? [];
        setPages(loadedPages);
        setPagesLoading(false);

        if (loadedPages.length === 0) {
          setDebugMessage(`Debug: Chapter ID ${currentChapter.id} reached. No images found in Supabase.`);
        }
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown reader error";
      setErrorMessage(message);
      setDebugMessage(`Debug: Reader route loaded for ${slug} chapter ${number}, but fetching failed: ${message}`);
      setPagesLoading(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug, number, user?.id]);

  // Auto-hide UI after 2.5s of no movement
  useEffect(() => {
    if (!unlocked) return;
    const reveal = () => {
      setShowUI(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowUI(false), 2500);
    };
    reveal();
    window.addEventListener("mousemove", reveal);
    window.addEventListener("scroll", reveal, { passive: true });
    window.addEventListener("touchstart", reveal, { passive: true });
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      window.removeEventListener("mousemove", reveal);
      window.removeEventListener("scroll", reveal);
      window.removeEventListener("touchstart", reveal);
    };
  }, [unlocked]);

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

  const renderTopBar = () => (
    <div
      className={`fixed top-0 inset-x-0 z-40 bg-gradient-to-b from-black/90 to-transparent transition-opacity duration-300 ${showUI ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/series/$slug" params={{ slug }} className="flex items-center gap-2 text-sm text-white/90 hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          <span className="font-bold truncate max-w-[40vw]">{series?.title ?? "Back to Series"}</span>
        </Link>
        <div className="text-xs uppercase tracking-wider text-white/70 font-bold">
          {chapter ? `CH ${Number(chapter.number)}${chapter.title ? ` · ${chapter.title}` : ""}` : `CH ${number}`}
        </div>
      </div>
    </div>
  );

  const renderBottomBar = () => (
    <div
      className={`fixed bottom-0 inset-x-0 z-40 bg-gradient-to-t from-black/95 to-transparent transition-opacity duration-300 ${showUI ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {siblings.prev !== undefined ? (
          <Button asChild variant="ghost" className="text-white hover:bg-white/10 rounded-[4px]">
            <Link to="/series/$slug/chapter/$number" params={{ slug, number: String(siblings.prev) }}>
              <ChevronLeft className="h-4 w-4" /> PREV
            </Link>
          </Button>
        ) : <div />}

        <select
          value={chapter ? String(chapter.number) : String(number)}
          onChange={(e) => navigate({ to: "/series/$slug/chapter/$number", params: { slug, number: e.target.value } })}
          className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-[4px] h-9 px-3 border border-white/15 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
        >
          {allChapters.map((n) => (
            <option key={n} value={String(n)} className="bg-black text-white">CH {n}</option>
          ))}
        </select>

        {siblings.next !== undefined ? (
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-[4px]">
            <Link to="/series/$slug/chapter/$number" params={{ slug, number: String(siblings.next) }}>
              NEXT <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : <div />}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black overflow-y-auto z-30">
        {renderTopBar()}
        <div className="min-h-screen flex items-center justify-center pt-20 pb-24">
          <div className="flex flex-col items-center gap-4 text-white/80">
            <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-primary animate-spin" />
            <p className="text-sm">Loading reader…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!series || !chapter) {
    return (
      <div className="fixed inset-0 bg-black overflow-y-auto z-30">
        {renderTopBar()}
        <div className="min-h-screen flex items-center justify-center p-4 pt-20 pb-24">
          <div className="max-w-xl w-full rounded-[6px] border border-border bg-card p-5 text-left shadow-card">
            <div className="flex items-start gap-3 text-primary">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <div className="space-y-2">
                <h1 className="text-lg font-bold text-foreground">Reader loaded, but this chapter is missing</h1>
                <p className="text-sm text-muted-foreground">{debugMessage ?? "Debug: The chapter route loaded but the requested chapter record was not found."}</p>
                {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="fixed inset-0 bg-black overflow-y-auto z-30">
        {renderTopBar()}
        <div className="min-h-screen flex items-center justify-center px-4 pt-20 pb-24">
          <div className="w-full max-w-md rounded-[4px] border border-border bg-card p-10 shadow-card text-center">
            <Lock className="mx-auto h-12 w-12 text-primary mb-3" />
            <h1 className="text-2xl font-bold">Chapter {Number(chapter.number)} is locked</h1>
            <p className="text-muted-foreground mt-1">{series.title}</p>
            <div className="my-6 inline-flex items-center gap-2 text-2xl font-bold">
              <Coins className="h-6 w-6 text-[var(--coin)]" /> {chapter.price}
            </div>
            {user && <p className="text-sm text-muted-foreground mb-4">Your balance: <span className="font-semibold text-foreground tabular-nums">{wallet?.coins ?? 0}</span></p>}
            <Button onClick={handleUnlock} disabled={unlocking} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-[4px] h-11">
              {unlocking ? "UNLOCKING…" : user ? "UNLOCK CHAPTER" : "SIGN IN TO UNLOCK"}
            </Button>
            <Button asChild variant="ghost" className="w-full mt-2"><Link to="/topup">Need more coins? Top up →</Link></Button>
          </div>
        </div>
        {renderBottomBar()}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-y-auto z-30">
      {renderTopBar()}
      <div className={`${series.type === "manga" ? "max-w-3xl mx-auto" : "max-w-2xl mx-auto px-4"} pt-20 pb-24`}>
        {series.type === "manga" ? (
          pagesLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4 text-white/80">
                <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-primary animate-spin" />
                <p className="text-sm">Loading chapter pages…</p>
              </div>
            </div>
          ) : pages.length === 0 ? (
            <div className="px-4 py-20">
              <div className="mx-auto max-w-xl rounded-[6px] border border-border bg-card p-5 text-left shadow-card">
                <div className="flex items-start gap-3 text-primary">
                  <AlertCircle className="h-5 w-5 mt-0.5" />
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-foreground">No reader images found</h2>
                    <p className="text-sm text-muted-foreground">{debugMessage ?? `Debug: Chapter ID ${chapter.id} reached. No images found in Supabase.`}</p>
                    {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            pages.map(p => <img key={p.id} src={p.image_url} alt={`Page ${p.page_number}`} loading="lazy" className="w-full block" />)
          )
        ) : (
          <article className="prose prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-base text-white/90">
            {chapter.content || "No content."}
          </article>
        )}
      </div>
      {renderBottomBar()}
    </div>
  );
}
