import { Link } from "@tanstack/react-router";
import { GenreTag } from "@/components/genre-tag";

const TABS = [
  { label: "New Manga", to: "/browse" as const },
  { label: "Top Manga", to: "/browse" as const },
  { label: "Last Updates", to: "/browse" as const },
  { label: "All", to: "/browse" as const },
];

const GENRES = [
  "Action", "Romance", "Fantasy", "Comedy", "Adventure",
  "Drama", "Mystery", "Supernatural", "School Life", "Shounen",
  "Shoujo", "Magic",
];

export function GenreBar() {
  return (
    <section className="border-b border-border/60 bg-background/40 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-5 overflow-x-auto whitespace-nowrap py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <Link
              key={t.label}
              to={t.to}
              className="text-[12px] font-extrabold uppercase tracking-wider text-foreground/90 hover:text-primary transition-colors py-1 border-b-2 border-transparent hover:border-primary"
            >
              {t.label}
            </Link>
          ))}
          <span className="h-5 w-px bg-border shrink-0" />
          {GENRES.map((g) => (
            <GenreTag key={g} name={g} size="sm" />
          ))}
        </div>
      </div>
    </section>
  );
}
