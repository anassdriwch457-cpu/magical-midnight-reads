import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { X, Lock, Check, BookOpen } from "lucide-react";

type ChapterLite = { id: string; number: number | string; title?: string | null; price: number };

/**
 * Cinematic quick-switch chapter drawer for the reader.
 * Glass overlay; ESC closes; click outside closes.
 */
export function QuickSwitchDrawer({
  open,
  onClose,
  seriesSlug,
  seriesTitle,
  chapters,
  unlockedIds,
  currentNumber,
}: {
  open: boolean;
  onClose: () => void;
  seriesSlug: string;
  seriesTitle: string;
  chapters: ChapterLite[];
  unlockedIds?: Set<string>;
  currentNumber: number | string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55]" role="dialog" aria-modal="true" aria-label="Quick switch chapters">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Drawer */}
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-sm glass-strong border-l border-white/10
                   flex flex-col animate-slide-up"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Quick Switch</p>
            <h3 className="text-sm font-extrabold text-white truncate">{seriesTitle}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="haptic grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-3 border-b border-white/10">
          <Link
            to="/series/$slug"
            params={{ slug: seriesSlug }}
            onClick={onClose}
            className="haptic inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/80 hover:text-primary"
          >
            <BookOpen className="h-3.5 w-3.5" /> Series Page
          </Link>
        </div>

        <ul className="flex-1 overflow-y-auto py-2">
          {chapters.length === 0 && (
            <li className="px-5 py-6 text-sm text-white/60">No chapters.</li>
          )}
          {chapters.map((c) => {
            const isCurrent = String(c.number) === String(currentNumber);
            const free = c.price === 0;
            const owned = unlockedIds?.has(c.id);
            return (
              <li key={c.id}>
                <Link
                  to="/series/$slug/chapter/$number"
                  params={{ slug: seriesSlug, number: String(c.number) }}
                  onClick={onClose}
                  className={`flex items-center justify-between gap-3 px-5 py-2.5 transition-colors ${
                    isCurrent
                      ? "bg-primary/15 text-primary"
                      : "text-white/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold">
                      Ch. {Number(c.number)}
                      {c.title ? <span className="font-medium opacity-80"> · {c.title}</span> : null}
                    </div>
                  </div>
                  {free ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">Free</span>
                  ) : owned ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      <Check className="h-3 w-3" /> Owned
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      <Lock className="h-3 w-3" /> {c.price}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
