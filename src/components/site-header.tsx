import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Coins, Sparkles, Moon, Square, User, LogOut, Shield, Palette, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/nuvia-logo.png";
import { resolveImage, onImageError } from "@/lib/image";

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
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
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

  const submitSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearchOpen(false);
    navigate({ to: "/browse", search: { q: trimmed } });
  };

  return (
    <header
      className={`fixed top-0 z-40 w-full transition-all duration-300 ${
        scrolled
          ? "bg-background/95 backdrop-blur-md border-b border-border/60"
          : "bg-gradient-to-b from-black/70 to-transparent border-b border-transparent"
      }`}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="Nuvia Toon" width={32} height={32} className="brightness-0 invert" />
          <div className="leading-tight">
            <div className="text-[17px] font-extrabold tracking-tight text-white">Nuvia Toon</div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-white/60 font-medium">
              Your Next Paradise in Every Page
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-[13px] font-extrabold tracking-wider">
          {NAV.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              className="text-white hover:text-primary transition-colors drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
              activeProps={{ className: "text-primary" }}
              activeOptions={{ exact: true }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div ref={searchRef} className="relative hidden md:block">
            <div className="flex items-center bg-white/10 hover:bg-white/15 focus-within:bg-white/20 rounded-full transition-colors w-56 lg:w-72">
              <Search className="h-4 w-4 text-white/70 ml-3" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(e) => { if (e.key === "Enter") submitSearch(query); if (e.key === "Escape") setSearchOpen(false); }}
                placeholder="Search series…"
                className="bg-transparent text-sm text-white placeholder:text-white/50 px-2 py-2 flex-1 outline-none"
              />
              {query && (
                <button onClick={() => { setQuery(""); setHits([]); }} className="mr-2 text-white/60 hover:text-white" aria-label="Clear">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {searchOpen && query.trim().length >= 2 && (
              <div className="absolute top-full mt-2 left-0 right-0 rounded-lg border border-border bg-popover shadow-xl overflow-hidden z-50">
                {searching && hits.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">Searching…</div>
                ) : hits.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">No matches for "{query}"</div>
                ) : (
                  <>
                    <ul className="max-h-80 overflow-auto">
                      {hits.map((h) => (
                        <li key={h.id}>
                          <Link
                            to="/series/$slug"
                            params={{ slug: h.slug }}
                            onClick={() => { setSearchOpen(false); setQuery(""); }}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/60 transition-colors"
                          >
                            <img src={h.cover_url ?? ""} alt="" className="h-10 w-7 object-cover rounded bg-muted shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{h.title}</div>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{h.type}</div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => submitSearch(query)}
                      className="w-full text-left px-3 py-2 border-t border-border text-xs font-bold uppercase tracking-wider text-primary hover:bg-muted/60"
                    >
                      See all results for "{query}" →
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Theme" className="text-white hover:text-primary hover:bg-white/10">
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
              <Link to="/topup" className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15 transition-colors">
                <Coins className="h-4 w-4 text-[var(--coin)]" />
                <span className="font-semibold tabular-nums">{wallet?.coins ?? 0}</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:text-primary hover:bg-white/10"><User className="h-[18px] w-[18px]" /></Button>
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
              className="bg-primary !text-white hover:bg-primary/90 font-extrabold rounded-[4px] tracking-wider ring-1 ring-white/20 shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
            >
              <Link to="/auth">SIGN IN</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
