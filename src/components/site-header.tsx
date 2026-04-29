import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Coins, Sparkles, Moon, Square, User, LogOut, Shield, Palette } from "lucide-react";
import logo from "@/assets/nuvia-logo.png";

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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
                  {PRESET_ACCENTS.map(c => (
                    <button
                      key={c}
                      onClick={() => setAccent(c)}
                      aria-label={`Use ${c}`}
                      className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${accent.toLowerCase() === c.toLowerCase() && theme === "custom" ? "border-foreground" : "border-transparent"}`}
                      style={{ background: c }}
                    />
                  ))}
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
