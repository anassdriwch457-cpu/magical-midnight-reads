import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Coins, Lock, Maximize2, Minimize2, ListOrdered, RefreshCw, Type } from "lucide-react";
import { toast } from "sonner";
import { QuickSwitchDrawer } from "@/components/quick-switch-drawer";
import { SparkleBurst } from "@/components/sparkle-burst";
import { motion, SPRING, SpringNumber } from "@/lib/motion";

type Chapter = Tables<"chapters">;
type Page = Tables<"chapter_pages">;
type Series = Tables<"series">;

// Normalize page image URLs: support absolute URLs and relative storage paths.
function resolveImageUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  const url = String(raw).trim();
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  // Relative path → resolve against current origin (Lovable Cloud storage URLs are absolute already)
  if (typeof window !== "undefined") {
    return url.startsWith("/") ? `${window.location.origin}${url}` : `${window.location.origin}/${url}`;
  }
  return url;
}

function normalizePages(rows: Page[]): Page[] {
  return rows.map((p) => ({ ...p, image_url: resolveImageUrl(p.image_url) }));
}

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
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [siblings, setSiblings] = useState<{ prev?: number; next?: number }>({});
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [showUI, setShowUI] = useState(true);
  const [cinematic, setCinematic] = useState(false);
  const [progress, setProgress] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sparkle, setSparkle] = useState(false);
  const [ambient, setAmbient] = useState<string>("oklch(0.62 0.20 305)");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sampledRef = useRef<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setErrorMessage(null);
    setDebugMessage(null);
    setPages([]);
    setPagesLoading(false);

    try {
      const { data: s, error: seriesError } = await supabase
        .from("series").select("*").eq("slug", slug).maybeSingle();
      if (seriesError) throw seriesError;
      if (!s) {
        setSeries(null); setChapter(null);
        setDebugMessage(`Debug: Series slug "${slug}" was reached, but no series was found.`);
        return;
      }
      setSeries(s);

      const { data: chapterRows, error: chaptersError } = await supabase
        .from("chapters").select("*").eq("series_id", s.id).order("number", { ascending: true });
      if (chaptersError) throw chaptersError;

      const allRows = chapterRows ?? [];
      setAllChapters(allRows);

      const nums = allRows.map((item) => Number(item.number));
      const currentChapter = allRows.find((item) => Number(item.number) === Number(number)) ?? null;
      if (!currentChapter) {
        setChapter(null); setSiblings({}); setUnlocked(false);
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
      if (user) {
        const { data: u } = await supabase.from("chapter_unlocks").select("chapter_id").eq("user_id", user.id);
        const unlockedSet = new Set((u ?? []).map((x) => x.chapter_id));
        setUnlockedIds(unlockedSet);
        if (!access) access = unlockedSet.has(currentChapter.id);
      }
      setUnlocked(access);

      if (s.type === "manga" && access) {
        setLoading(false);
        setPagesLoading(true);
        const { data: pageRows, error: pagesError } = await supabase
          .from("chapter_pages").select("*").eq("chapter_id", currentChapter.id).order("page_number", { ascending: true });
        if (pagesError) throw pagesError;
        const loadedPages = normalizePages(pageRows ?? []);
        // eslint-disable-next-line no-console
        console.log("[Reader] Chapter data:", { series: s, chapter: currentChapter, pages: loadedPages });
        setPages(loadedPages);
        setPagesLoading(false);
        if (loadedPages.length === 0) {
          setDebugMessage(`Debug: Chapter ID ${currentChapter.id} reached. No pages were returned from the database.`);
        }
        return;
      }
      // Novel — log the content for debugging
      if (s.type !== "manga") {
        // eslint-disable-next-line no-console
        console.log("[Reader] Novel chapter:", { series: s, chapter: currentChapter, contentLength: currentChapter.content?.length ?? 0 });
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

  // Auto-hide UI
  useEffect(() => {
    if (!unlocked) return;
    const reveal = () => {
      setShowUI(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowUI(false), 2800);
    };
    reveal();
    const scroller = scrollerRef.current;
    window.addEventListener("mousemove", reveal);
    window.addEventListener("touchstart", reveal, { passive: true });
    scroller?.addEventListener("scroll", reveal, { passive: true });
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      window.removeEventListener("mousemove", reveal);
      window.removeEventListener("touchstart", reveal);
      scroller?.removeEventListener("scroll", reveal);
    };
  }, [unlocked]);

  // Scroll progress
  useEffect(() => {
    if (!unlocked) return;
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = el.scrollHeight - el.clientHeight;
        setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
      });
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); el.removeEventListener("scroll", onScroll); };
  }, [unlocked, pages.length]);

  // Ambient light: sample dominant color from page imgs as they enter the viewport
  const samplePage = (img: HTMLImageElement, key: string) => {
    if (sampledRef.current.has(key)) return;
    sampledRef.current.add(key);
    try {
      const canvas = document.createElement("canvas");
      const w = (canvas.width = 24);
      const h = (canvas.height = 36);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 128) continue;
        // Skip near-black/white to capture meaningful color
        const br = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (br < 30 || br > 240) continue;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      if (n < 20) return;
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
      setAmbient(`rgb(${r}, ${g}, ${b})`);
    } catch {
      // Cross-origin canvas tainting — skip silently
    }
  };

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
    setSparkle(true);
    toast.success(`Chapter ${Number(chapter.number)} unlocked!`, {
      description: `−${chapter.price} coins · Balance: ${r.balance ?? "—"} coins remaining`,
      icon: "🔓",
      duration: 4000,
    });
    await refreshWallet();
    await load();
  };

  const uiVisible = showUI && !cinematic;

  const drawerChapters = useMemo(
    () => allChapters.map((c) => ({ id: c.id, number: c.number, title: c.title, price: c.price })),
    [allChapters]
  );

  const renderTopBar = () => (
    <div className={`fixed top-0 inset-x-0 z-40 transition-opacity duration-300 ${uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className="glass-strong">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/series/$slug" params={{ slug }} className="haptic flex items-center gap-2 text-sm text-white/90 hover:text-primary min-w-0">
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="font-bold truncate max-w-[40vw]">{series?.title ?? "Back to Series"}</span>
          </Link>
          <div className="text-xs uppercase tracking-wider text-white/70 font-bold truncate hidden sm:block">
            {chapter ? `CH ${Number(chapter.number)}${chapter.title ? ` · ${chapter.title}` : ""}` : `CH ${number}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Quick switch chapters"
              className="haptic shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white"
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Chapters</span>
            </button>
            <button
              onClick={() => setCinematic((c) => !c)}
              aria-label={cinematic ? "Exit cinematic mode" : "Enter cinematic mode"}
              className="haptic shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white"
            >
              {cinematic ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{cinematic ? "Exit" : "Cinema"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProgressBar = () => (
    <div className="fixed top-0 inset-x-0 z-50 h-0.5 bg-white/5 pointer-events-none">
      <div
        className="h-full transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%`, background: "var(--gradient-aurora)", boxShadow: "0 0 12px var(--neon-purple)" }}
      />
    </div>
  );

  const renderCinemaExit = () => (
    cinematic && (
      <button
        onClick={() => setCinematic(false)}
        aria-label="Exit cinematic mode"
        className="haptic fixed top-3 right-3 z-50 inline-flex items-center justify-center h-9 w-9 rounded-full glass text-white"
      >
        <Minimize2 className="h-4 w-4" />
      </button>
    )
  );

  const renderBottomBar = () => (
    <div className={`fixed bottom-0 inset-x-0 z-40 glass-strong transition-opacity duration-300 ${uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
         style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="container mx-auto px-3 h-16 flex items-center justify-between gap-2">
        {siblings.prev !== undefined ? (
          <Button asChild variant="ghost" className="haptic text-white hover:bg-white/10 rounded-full">
            <Link to="/series/$slug/chapter/$number" params={{ slug, number: String(siblings.prev) }}>
              <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">PREV</span>
            </Link>
          </Button>
        ) : <div className="w-16" />}

        <button
          onClick={() => setDrawerOpen(true)}
          className="haptic inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-full h-9 px-4 ring-1 ring-white/15"
        >
          <ListOrdered className="h-3.5 w-3.5" />
          CH {chapter ? Number(chapter.number) : number}
        </button>

        {siblings.next !== undefined ? (
          <Button asChild className="haptic bg-aurora text-white border-0 hover:opacity-95 font-bold rounded-full px-5 shadow-glow">
            <Link to="/series/$slug/chapter/$number" params={{ slug, number: String(siblings.next) }}>
              <span className="hidden sm:inline">NEXT</span> <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : <div className="w-16" />}
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
          <div className="max-w-xl w-full rounded-2xl glass-card p-5 text-left shadow-card">
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
          {/* Aurora ambient backdrop */}
          <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-screen blur-3xl animate-ambient"
               style={{ background: "var(--gradient-aurora)" }} aria-hidden />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={SPRING.soft}
            className="relative w-full max-w-md rounded-2xl glass-card p-10 shadow-elev text-center inner-highlight"
          >
            <div className="relative inline-grid place-items-center mb-3">
              <span className="absolute h-16 w-16 rounded-full animate-pulse-ring" aria-hidden />
              <motion.div
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={SPRING.snap}
                className="relative grid h-14 w-14 place-items-center rounded-full bg-aurora text-white shadow-glow"
              >
                <Lock className="h-6 w-6" />
              </motion.div>
            </div>
            <h1 className="text-2xl font-extrabold">Chapter {Number(chapter.number)} is locked</h1>
            <p className="text-muted-foreground mt-1">{series.title}</p>
            <div className="my-6 inline-flex items-center gap-2 text-2xl font-extrabold">
              <Coins className="h-6 w-6 text-[var(--coin)]" /> <span className="shimmer-text">{chapter.price}</span>
            </div>
            {user && (
              <p className="text-sm text-muted-foreground mb-4">
                Your balance:{" "}
                <SpringNumber
                  value={wallet?.coins ?? 0}
                  className="font-semibold text-foreground tabular-nums"
                />
              </p>
            )}
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} transition={SPRING.snap}>
              <Button onClick={handleUnlock} disabled={unlocking} className="focus-ring w-full bg-aurora text-white border-0 hover:opacity-95 font-bold rounded-full h-11 shadow-glow">
                {unlocking ? "UNLOCKING…" : user ? "UNLOCK CHAPTER" : "SIGN IN TO UNLOCK"}
              </Button>
            </motion.div>
            <Button asChild variant="ghost" className="w-full mt-2 text-white/80 hover:text-white"><Link to="/topup">Need more coins? Top up →</Link></Button>
          </motion.div>
        </div>
        {renderBottomBar()}
        <QuickSwitchDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          seriesSlug={slug}
          seriesTitle={series.title}
          chapters={drawerChapters}
          unlockedIds={unlockedIds}
          currentNumber={chapter.number}
        />
        {sparkle && <SparkleBurst onDone={() => setSparkle(false)} />}
      </div>
    );
  }

  const goToChapter = (n: number) =>
    navigate({ to: "/series/$slug/chapter/$number", params: { slug, number: String(n) } });

  return (
    <div ref={scrollerRef} className="fixed inset-0 bg-black overflow-y-auto z-30 [scroll-behavior:smooth]">
      {/* Ambient light backdrop reflecting current page color */}
      <div
        className="pointer-events-none fixed inset-0 -z-0 opacity-50 transition-[background] duration-700 ease-out"
        aria-hidden
        style={{
          background: `radial-gradient(60% 50% at 50% 30%, ${ambient} 0%, transparent 65%), radial-gradient(70% 60% at 50% 90%, ${ambient} 0%, transparent 70%)`,
          filter: "blur(60px) saturate(120%)",
        }}
      />

      {/* Mobile edge tap zones for chapter nav */}
      {siblings.prev !== undefined && (
        <button
          aria-label="Previous chapter"
          onClick={() => goToChapter(siblings.prev!)}
          className="md:hidden fixed left-0 top-1/2 -translate-y-1/2 z-20 h-32 w-10 grid place-items-center text-white/0 active:text-white/80 active:bg-white/5 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {siblings.next !== undefined && (
        <button
          aria-label="Next chapter"
          onClick={() => goToChapter(siblings.next!)}
          className="md:hidden fixed right-0 top-1/2 -translate-y-1/2 z-20 h-32 w-10 grid place-items-center text-white/0 active:text-white/80 active:bg-white/5 transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Reading-time chip — shown briefly on entry */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: [0, 1, 1, 0], y: [-10, 0, 0, -10] }}
        transition={{ duration: 3.4, times: [0, 0.15, 0.85, 1], delay: 0.6 }}
        className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/90"
      >
        Chapter {Number(chapter.number)}
        {pages.length > 0 && <span className="text-white/55">· ~{Math.max(1, Math.ceil(pages.length * 0.4))} min</span>}
      </motion.div>

      {renderProgressBar()}
      {renderTopBar()}
      {renderCinemaExit()}
      <div className={`relative z-10 ${series.type === "manga" ? "max-w-3xl mx-auto" : "max-w-2xl mx-auto px-4"} ${cinematic ? "pt-2 pb-2" : "pt-20 pb-24"}`}>
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
              <div className="mx-auto max-w-xl rounded-2xl glass-card p-5 text-left shadow-card">
                <div className="flex items-start gap-3 text-primary">
                  <AlertCircle className="h-5 w-5 mt-0.5" />
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-foreground">No reader images found</h2>
                     <p className="text-sm text-muted-foreground">{debugMessage ?? `Debug: Chapter ID ${chapter.id} reached. No images were returned from your Laravel API.`}</p>
                    {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            pages.map((p, i) => (
              <motion.img
                key={p.id}
                src={p.image_url}
                alt={`Page ${p.page_number}`}
                loading={i < 2 ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={i < 2 ? "high" : "low"}
                draggable={false}
                crossOrigin="anonymous"
                onLoad={(e) => { if (i < 4) samplePage(e.currentTarget, p.id); }}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
                transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
                className="w-full block select-none [content-visibility:auto] [contain-intrinsic-size:1200px] shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
              />
            ))
          )
        ) : (
          <article className="prose prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-base text-white/90">
            {chapter.content || "No content."}
          </article>
        )}

        {/* End-of-chapter CTA */}
        {unlocked && pages.length > 0 && siblings.next !== undefined && (
          <div className="mt-10 mb-4 flex justify-center">
            <Button asChild size="lg" className="haptic bg-aurora text-white border-0 hover:opacity-95 font-bold rounded-full h-12 px-8 shadow-glow">
              <Link to="/series/$slug/chapter/$number" params={{ slug, number: String(siblings.next) }}>
                NEXT CHAPTER <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {renderBottomBar()}

      <QuickSwitchDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        seriesSlug={slug}
        seriesTitle={series.title}
        chapters={drawerChapters}
        unlockedIds={unlockedIds}
        currentNumber={chapter.number}
      />

      {sparkle && <SparkleBurst onDone={() => setSparkle(false)} />}
    </div>
  );
}
