import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Coins, Sparkles } from "lucide-react";
import { toast } from "sonner";

const PACKAGES = [
  { coins: 100, price: "$1.99", bonus: 0 },
  { coins: 550, price: "$9.99", bonus: 50 },
  { coins: 1200, price: "$19.99", bonus: 200 },
  { coins: 3500, price: "$49.99", bonus: 750 },
];

export const Route = createFileRoute("/topup")({
  component: TopupPage,
  head: () => ({ meta: [{ title: "Top Up Coins — Nuvia Toon" }] }),
});

function TopupPage() {
  const { user, wallet } = useAuth();

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="text-center mb-10">
        <Sparkles className="mx-auto h-10 w-10 text-primary mb-3 animate-pulse" />
        <h1 className="text-4xl font-bold text-brand">Top Up Coins</h1>
        <p className="text-muted-foreground mt-2">Coins unlock premium chapters across Nuvia Toon — permanently.</p>
        {user && (
          <div className="inline-flex items-center gap-2 mt-4 rounded-full border border-border bg-card px-4 py-2">
            <Coins className="h-4 w-4 text-[var(--coin)]" />
            <span className="font-semibold tabular-nums">{wallet?.coins ?? 0}</span>
            <span className="text-muted-foreground text-sm">current balance</span>
          </div>
        )}
      </div>

      {!user ? (
        <div className="text-center py-16 rounded-xl border border-border bg-card">
          <p className="mb-4">Sign in to purchase coins.</p>
          <Button asChild className="bg-brand text-primary-foreground border-0"><Link to="/auth">Sign In</Link></Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PACKAGES.map((p) => (
              <div key={p.coins} className="relative rounded-2xl border border-border bg-card p-6 hover:shadow-glow transition-all hover:-translate-y-1">
                {p.bonus > 0 && (
                  <div className="absolute -top-2 -right-2 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-primary-foreground">+{p.bonus} bonus</div>
                )}
                <Coins className="h-10 w-10 text-[var(--coin)] mb-3" />
                <div className="text-3xl font-bold tabular-nums">{p.coins.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">coins</div>
                <div className="mt-4 text-xl font-semibold">{p.price}</div>
                <Button
                  className="w-full mt-4 bg-brand text-primary-foreground border-0"
                  onClick={() => toast.info("Stripe checkout coming next — wire up Lovable Payments to enable.")}
                >
                  Buy now
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground mt-8">Secure payments via Stripe. PayPal available later. Coins never expire.</p>
        </>
      )}
    </div>
  );
}
