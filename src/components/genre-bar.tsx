import { Link } from "@tanstack/react-router";
import { Sparkles, TrendingUp, Clock, LayoutGrid } from "lucide-react";

const PRIMARY = [
  { label: "New Manga", icon: Sparkles, to: "/browse", search: { sort: "latest", type: "manga" } },
  { label: "Top Manga", icon: TrendingUp, to: "/browse", search: { sort: "popular", type: "manga" } },
  { label: "Last Updates", icon: Clock, to: "/browse", search: { sort: "latest" } },
  { label: "All Genres", icon: LayoutGrid, to: "/browse", search: {} },
] as const;

const GENRES = ["Yaoi","Comedy","Shounen Ai","Yuri","Shoujo","Fantasy","Josei","School Life"];

export function GenreBar() {
  return (
    <section className="container mx-auto px-4 py-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PRIMARY.map(({ label, icon: Icon, to }) => (
          <Link
            key={label}
            to={to}
            className="group relative flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-sm md:text-base font-semibold text-primary-foreground shadow-card transition-all hover:shadow-glow hover:-translate-y-0.5"
          >
            <Icon className="h-4 w-4 opacity-90" />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      <nav
        aria-label="Genres"
        className="flex items-center gap-3 overflow-x-auto whitespace-nowrap pb-1 text-sm text-muted-foreground [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {GENRES.map((g, i) => (
          <span key={g} className="flex items-center gap-3">
            <Link
              to="/browse"
              className="transition-colors hover:text-[var(--neon-pink)] hover:drop-shadow-[0_0_8px_var(--neon-pink)]"
            >
              {g}
            </Link>
            {i < GENRES.length - 1 && <span className="text-border">|</span>}
          </span>
        ))}
      </nav>
    </section>
  );
}
