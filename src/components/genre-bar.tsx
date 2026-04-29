import { Link } from "@tanstack/react-router";

const TABS = [
  { label: "New Manga", search: { sort: "latest", type: "manga" } },
  { label: "Top Manga", search: { sort: "popular", type: "manga" } },
  { label: "Last Updates", search: { sort: "latest" } },
  { label: "All", search: {} },
];

const GENRES = ["Action", "Romance", "Fantasy", "Comedy", "Shounen Ai", "Yaoi", "Yuri", "Shoujo", "Josei", "School Life", "Adventure", "Drama"];

export function GenreBar() {
  return (
    <section className="border-b border-border/60 bg-background/60">
      <div className="container mx-auto px-4">
        <div
          className="flex items-center gap-7 overflow-x-auto whitespace-nowrap py-3 text-[13px] font-bold uppercase tracking-wider [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t) => (
            <Link
              key={t.label}
              to="/browse"
              className="text-foreground/90 hover:text-primary transition-colors py-1 border-b-2 border-transparent hover:border-primary"
            >
              {t.label}
            </Link>
          ))}
          <span className="h-5 w-px bg-border" />
          {GENRES.map((g) => (
            <Link
              key={g}
              to="/browse"
              className="text-muted-foreground hover:text-primary transition-colors py-1"
            >
              {g}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
