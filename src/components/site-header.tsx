import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Coins, Sparkles, Moon, Square, User, LogOut, Shield, Palette } from "lucide-react";
import logo from "@/assets/nuvia-logo.png";

const PRESET_ACCENTS = ["#d946ef", "#a855f7", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

export function SiteHeader() {
  const { user, wallet, isAdmin, signOut } = useAuth();
  const { theme, setTheme, accent, setAccent } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <img src={logo} alt="Nuvia Toon" width={36} height={36} className="animate-float drop-shadow-[0_0_12px_var(--neon-pink)]" />
          <div className="leading-tight">
            <div className="text-xl font-bold tracking-tight text-brand">Nuvia Toon</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Magic · Stories · Worlds</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/" className="hover:text-primary transition-colors" activeProps={{ className: "text-primary" }}>Home</Link>
          <Link to="/browse" className="hover:text-primary transition-colors" activeProps={{ className: "text-primary" }}>Browse</Link>
          <Link to="/topup" className="hover:text-primary transition-colors" activeProps={{ className: "text-primary" }}>Top Up</Link>
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Theme">
                {theme === "magic" ? <Sparkles className="h-4 w-4" /> : theme === "midnight" ? <Moon className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTheme("magic")}><Sparkles className="mr-2 h-4 w-4" /> Magic</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("midnight")}><Moon className="mr-2 h-4 w-4" /> Midnight</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("concrete")}><Square className="mr-2 h-4 w-4" /> Concrete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <>
              <Link to="/topup" className="hidden sm:flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:shadow-glow transition-shadow">
                <Coins className="h-4 w-4 text-[var(--coin)]" />
                <span className="font-semibold tabular-nums">{wallet?.coins ?? 0}</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon"><User className="h-4 w-4" /></Button>
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
            <Button asChild className="bg-brand text-primary-foreground border-0 hover:opacity-90">
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
