import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Coins, Sparkles, Moon, Square, User, LogOut, Shield, Palette, Search, X,
} from "lucide-react";
import { CoinBadge } from "@/components/coin-badge";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/nuvia-logo.png";
import { resolveImage, onImageError } from "@/lib/image";
import { motion, AnimatePresence, SPRING } from "@/lib/motion";

type SearchHit = { id: string; title: string; slug: string; cover_url: string | null; type: string };

const PRESET_ACCENTS = ["#F47521", "#E11D48", "#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#06B6D4"];

const NAV = [
  { to: "/", label: "HOME" },
  { to: "/browse", label: "BROWSE" },
  { to: "/browse", label: "MANGA", search: { type: "manga" } },
  { to: "/browse", label: "NOVELS", search: { type: "novel" } },
] as const;

export function SiteHeader() {
  const { user, wallet, isAdmin, signOut } = useAuth();
  const { theme, setTheme, accent, setAccent } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("series")
        .select("id, title, slug, cover_url, type")
        .ilike("title", `%${q}%`)
        .limit(6);
      setHits(data ?? []);
      setSearching(false);
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  // Cmd/Ctrl-K to focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        const input = searchRef.current?.querySelector("input");
        (input as HTMLInputElement | null)?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submitSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearchOpen(false);
    navigate({ to: "/browse", search: { q: trimmed } });
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={SPRING.soft}
      className={`fixed top-0 z-40 w-full transition-all duration-500 ${
        scrolled
          ? "glass-strong shadow-[0_8px_30px_-12px_rgba(0,0,0,0.7)]"
          : "bg-gradient-to-b from-black/65 via-black/25 to-transparent backdrop-blur-sm border-b border-transparent"
      }`}
    >
      <div className={`container mx-auto flex items-center justify-between px-4 transition-all duration-500 ${scrolled ? "h-14" : "h-16"}`}>
        {/* WORDMARK */}
        <Link to="/" className="focus-ring rounded-md flex items-center gap-2.5 group shrink-0">
          <motion.img
            src={logo}
            alt="Nuvia Toon"
            width={32}
            height={32}
            className="brightness-0 invert"
            whileHover={{ rotate: 8, scale: 1.06 }}
            transition={SPRING.snap}
          />
          <div className="leading-tight">
            <div className={`font-extrabold tracking-tight text-white transition-all duration-500 ${scrolled ? "text-[17px]" : "text-[19px]"}`}>
              <span className="wordmark text-aurora">Nuvia</span>
              <span className="wordmark text-white/95"> Toon</span>
            </div>
            <div className="text-[9px] uppercase tracking-[0.24em] text-white/55 font-semibold">
              Your Next <span className="wordmark not-italic font-semibold text-primary/95">Paradise</span> in Every Page
            </div>
          </div>
        </Link>

        {/* NAV with magnetic underline */}
        <nav
          className="hidden md:flex items-center gap-1 text-[12px] font-extrabold tracking-[0.18em] relative"
          onMouseLeave={() => setHoveredNav(null)}
        >
          {NAV.map((n) => {
            const key = `${n.to}-${n.label}`;
            const active = pathname === n.to && !("search" in n);
            const focused = hoveredNav === key || active;
            return (
              <Link
                key={key}
                to={n.to}
                onMouseEnter={() => setHoveredNav(key)}
                className={`focus-ring relative px-3.5 py-2 rounded-md transition-colors ${
                  focused ? "text-white" : "text-white/70 hover:text-white"
                }`}
              >
                <span className="relative z-10">{n.label}</span>
                <AnimatePresence>
                  {hoveredNav === key && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-md bg-white/10 ring-1 ring-white/15"
                      transition={SPRING.soft}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  )}
                </AnimatePresence>
                {active && (
                  <motion.span
                    layoutId="nav-active-bar"
                    className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-aurora"
                    transition={SPRING.soft}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* SEARCH */}
          <div ref={searchRef} className="relative hidden md:block">
            <motion.div
              layout
              transition={SPRING.snap}
              className={`flex items-center bg-white/10 hover:bg-white/15 focus-within:bg-white/20 rounded-full transition-colors ${
                searchOpen || query ? "w-72 lg:w-96" : "w-56 lg:w-64"
              }`}
            >
              <Search className="h-4 w-4 text-white/70 ml-3" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(e) => { if (e.key === "Enter") submitSearch(query); if (e.key === "Escape") setSearchOpen(false); }}
                placeholder="Search series…"
                className="bg-transparent text-sm text-white placeholder:text-white/50 px-2 py-2 flex-1 outline-none"
              />
              {!query && (
                <kbd className="mr-2 hidden lg:inline-flex h-5 items-center rounded border border-white/15 bg-white/5 px-1.5 text-[10px] font-mono text-white/60">
                  ⌘K
                </kbd>
              )}
              {query && (
                <button onClick={() => { setQuery(""); setHits([]); }} className="mr-2 text-white/60 hover:text-white" aria-label="Clear">
                  <X className="h-4 w-4" />
                </button>
              )}
            </motion.div>

            <AnimatePresence>
              {searchOpen && query.trim().length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={SPRING.snap}
                  className="absolute top-full mt-2 left-0 right-0 rounded-2xl glass-card overflow-hidden z-50 shadow-elev"
                >
                  {searching && hits.length === 0 ? (
                    <div className="px-4 py-5 text-sm text-muted-foreground">Searching…</div>
                  ) : hits.length === 0 ? (
                    <div className="px-4 py-5 text-sm text-muted-foreground">No matches for "{query}"</div>
                  ) : (
                    <>
                      <ul className="max-h-80 overflow-auto">
                        {hits.map((h) => (
                          <li key={h.id}>
                            <Link
                              to="/series/$slug"
                              params={{ slug: h.slug }}
                              onClick={() => { setSearchOpen(false); setQuery(""); }}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors"
                            >
                              <img src={resolveImage(h.cover_url)} onError={onImageError} alt="" className="h-12 w-9 object-cover rounded-md bg-muted shrink-0 ring-1 ring-white/10" />
                              <div className="min-w-0">
                                <div className="text-sm font-bold truncate text-foreground">{h.title}</div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{h.type}</div>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => submitSearch(query)}
                        className="w-full text-left px-3 py-2.5 border-t border-white/5 text-xs font-extrabold uppercase tracking-[0.2em] text-primary hover:bg-white/5"
                      >
                        See all results for "{query}" →
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* THEME */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Theme" className="focus-ring text-white hover:text-primary hover:bg-white/10">
                {theme === "magic" ? <Sparkles className="h-[18px] w-[18px]" /> : theme === "midnight" ? <Moon className="h-[18px] w-[18px]" /> : theme === "concrete" ? <Square className="h-[18px] w-[18px]" /> : <Palette className="h-[18px] w-[18px]" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTheme("magic")}><Sparkles className="mr-2 h-4 w-4" /> Magic</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("midnight")}><Moon className="mr-2 h-4 w-4" /> Midnight</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("concrete")}><Square className="mr-2 h-4 w-4" /> Concrete</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2"><Palette className="h-3.5 w-3.5" /> Custom Accent</DropdownMenuLabel>
              <div className="px-2 pb-2 space-y-2">
                <div className="grid grid-cols-8 gap-1.5">
                  {PRESET_ACCENTS.map(c => {
                    const active = accent.toLowerCase() === c.toLowerCase() && theme === "custom";
                    return (
                      <button
                        key={c}
                        onClick={() => setAccent(c)}
                        aria-label={`Use ${c}`}
                        className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${active ? "border-foreground ring-2 ring-foreground/40" : "border-border"}`}
                        style={{ background: c }}
                      />
                    );
                  })}
                </div>
                <label className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                  <span className="text-muted-foreground">Pick color</span>
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="h-6 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                </label>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <>
              <CoinBadge coins={wallet?.coins ?? 0} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="focus-ring text-white hover:text-primary hover:bg-white/10"><User className="h-[18px] w-[18px]" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/topup"><Coins className="mr-2 h-4 w-4" /> Top Up Coins</Link></DropdownMenuItem>
                  {isAdmin && <DropdownMenuItem asChild><Link to="/admin"><Shield className="mr-2 h-4 w-4" /> Admin</Link></DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              asChild
              variant="premium"
              size="default"
              className="focus-ring h-9 px-4 text-[12px]"
            >
              <Link to="/auth">SIGN IN</Link>
            </Button>
          )}
        </div>
      </div>
    </motion.header>
  );
}
