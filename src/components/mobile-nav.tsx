import { Link, useLocation } from "@tanstack/react-router";
import { Home, Compass, BookOpen, Coins, User } from "lucide-react";
import { useAuth } from "@/lib/auth";

type NavItem = { to: "/" | "/browse" | "/topup"; label: string; icon: typeof Home; exact?: boolean };
const ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/browse", label: "Browse", icon: Compass },
  { to: "/browse", label: "Manga", icon: BookOpen },
  { to: "/topup", label: "Coins", icon: Coins },
];

export function MobileNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden
                 border-t border-white/10
                 bg-background/70 backdrop-blur-xl backdrop-saturate-150
                 supports-[backdrop-filter]:bg-background/55"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around h-14">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          return (
            <li key={it.label} className="flex-1">
              <Link
                to={it.to}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {it.label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <Link
            to={user ? "/topup" : "/auth"}
            className={`flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              pathname === "/auth" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-5 w-5" />
            {user ? "Me" : "Sign in"}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
