import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Coins, Sparkles, Check, Zap, Crown, Star, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createCoinCheckout } from "@/server/topup.functions";

const ICONS = [Coins, Star, Zap, Crown];

const PACKAGES = [
  { id: "starter", label: "Starter Pack", coins: 100, bonus: 0, price: 1.0 },
  { id: "popular", label: "Reader Pack", coins: 500, bonus: 50, price: 4.5, popular: true },
  { id: "value",   label: "Collector Pack", coins: 1200, bonus: 200, price: 9.99 },
  { id: "ultimate", label: "Legend Pack", coins: 3500, bonus: 750, price: 24.99 },
];

export const Route = createFileRoute("/topup")({
  component: TopupPage,
  head: () => ({
    meta: [
      { title: "Top Up Coins — Nuvia Toon" },
      { name: "description", content: "Buy coins to unlock premium chapters. Coins never expire." },
    ],
  }),
});

function TopupPage() {
  const { user, wallet } = useAuth();
  const checkout = useServerFn(createCoinCheckout);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleBuy = async (packageId: string) => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    setPendingId(packageId);
    try {
      const { url } = await checkout({ data: { packageId } });
      if (url) window.location.href = url;
      else toast.error("Could not start checkout");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Checkout failed");
      setPendingId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="text-center mb-10">
        <Sparkles className="mx-auto h-10 w-10 text-primary mb-3" />
        <h1 className="text-4xl md:text-5xl font-bold text-brand">Top Up Coins</h1>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
          Coins unlock premium chapters across Nuvia Toon — permanently. No subscriptions, no expiry.
        </p>
        {user && (
          <div className="inline-flex items-center gap-2 mt-5 rounded-full border border-border bg-card px-4 py-2">
            <Coins className="h-4 w-4 text-[var(--coin)]" />
            <span className="font-bold tabular-nums">{wallet?.coins ?? 0}</span>
            <span className="text-muted-foreground text-sm">current balance</span>
          </div>
        )}
      </div>

      {!user ? (
        <div className="text-center py-16 rounded-xl border border-border bg-card">
          <p className="mb-4">Sign in to purchase coins.</p>
          <Button asChild className="bg-brand text-primary-foreground border-0">
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PACKAGES.map((p, i) => {
              const Icon = ICONS[i] ?? Coins;
              const total = p.coins + p.bonus;
              const popular = "popular" in p && p.popular;
              const isPending = pendingId === p.id;
              return (
                <div
                  key={p.id}
                  className={`relative rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-glow ${
                    popular ? "border-primary shadow-glow" : "border-border"
                  }`}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      Most Popular
                    </div>
                  )}
                  {p.bonus > 0 && (
                    <div className="absolute -top-2 -right-2 rounded-full bg-[#F47521] px-2.5 py-1 text-[10px] font-bold text-black">
                      +{p.bonus} BONUS
                    </div>
                  )}

                  <Icon className="h-9 w-9 text-[var(--coin)] mb-3" />
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">{p.label}</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tabular-nums">{total.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">coins</span>
                  </div>
                  {p.bonus > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {p.coins.toLocaleString()} + {p.bonus} bonus
                    </div>
                  )}
                  <div className="mt-4 text-2xl font-semibold">${p.price.toFixed(2)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    ≈ ${((p.price / total) * 100).toFixed(2)} per 100 coins
                  </div>

                  <Button
                    onClick={() => handleBuy(p.id)}
                    disabled={isPending || pendingId !== null}
                    className="w-full mt-5 bg-brand text-primary-foreground border-0 font-bold rounded-[4px] h-11"
                  >
                    {isPending ? "Redirecting…" : "BUY NOW"}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="mt-10 grid sm:grid-cols-3 gap-4 text-sm">
            {[
              { icon: Check, t: "Coins never expire" },
              { icon: ShieldCheck, t: "Secure checkout powered by Stripe" },
              { icon: Sparkles, t: "Coins credited automatically after payment" },
            ].map(({ icon: I, t }) => (
              <div key={t} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
                <I className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">{t}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-center text-muted-foreground mt-6">
            You'll be redirected to Stripe to complete your purchase. Coins are credited to your
            wallet only after successful payment.
          </p>
        </>
      )}
    </div>
  );
}
