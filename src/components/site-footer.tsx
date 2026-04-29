import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/60 bg-card/30 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="flex items-center gap-2 font-extrabold tracking-tight">
            <Sparkles className="h-4 w-4 text-primary" />
            Nuvia Toon
          </div>
          <p className="mt-3 text-muted-foreground text-xs leading-relaxed">
            Your next paradise in every page. Read trending manhwa and novels with a magical experience.
          </p>
        </div>
        <FooterCol title="Explore" links={[
          { to: "/", label: "Home" },
          { to: "/browse", label: "Browse" },
          { to: "/topup", label: "Buy Coins" },
        ]} />
        <FooterCol title="Legal" links={[
          { to: "/terms", label: "Terms of Service" },
          { to: "/privacy", label: "Privacy Policy" },
        ]} />
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">Support</div>
          <p className="text-muted-foreground text-xs">
            Need help? Reach out via your account page after signing in.
          </p>
        </div>
      </div>
      <div className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Nuvia Toon. All rights reserved.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">{title}</div>
      <ul className="space-y-2">
        {links.map(l => (
          <li key={l.to}>
            <Link to={l.to} className="text-foreground/80 hover:text-primary transition-colors">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
