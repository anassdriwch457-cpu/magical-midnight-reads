import { Link, useLocation } from "@tanstack/react-router";
import { Home, Compass, Search, Coins, User } from "lucide-react";
import { useAuth } from "@/lib/auth";

type NavItem = { to: "/" | "/browse" | "/topup" | "/auth"; label: string; icon: typeof Home; exact?: boolean };

/**
 * Thumb-driven bottom nav with a centered FAB-style search.
 * Glassmorphism, safe-area aware, haptic press.
 */
export function MobileNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const left: NavItem[] = [
    { to: "/", label: "Home", icon: Home, exact: true },
    { to: "/browse", label: "Browse", icon: Compass },
  ];
  const right: NavItem[] = [
    { to: "/topup", label: "Coins", icon: Coins },
    { to: user ? "/topup" : "/auth", label: user ? "Me" : "Sign in", icon: User },
  ];

  const renderItem = (it: NavItem) => {
    const Icon = it.icon;
    const active = it.exact ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + "/");
    return (
      <Link
        to={it.to}
        className={`haptic flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
        {it.label}
      </Link>
    );
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden glass-strong"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="relative flex items-stretch h-16">
        <div className="flex flex-1">{left.map((it) => <div key={it.label} className="flex flex-1">{renderItem(it)}</div>)}</div>
        {/* Center FAB-search */}
        <Link
          to="/browse"
          aria-label="Search"
          className="haptic absolute left-1/2 -top-5 -translate-x-1/2 grid h-14 w-14 place-items-center rounded-full
                     text-primary-foreground shadow-glow ring-2 ring-background bg-aurora"
        >
          <Search className="h-5 w-5" />
        </Link>
        <div className="flex flex-1">{right.map((it) => <div key={it.label} className="flex flex-1">{renderItem(it)}</div>)}</div>
      </div>
    </nav>
  );
}
