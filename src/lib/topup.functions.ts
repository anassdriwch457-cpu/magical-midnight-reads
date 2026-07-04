import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Server-side source of truth so clients can't tamper with package amounts.
export const COIN_PACKAGES = [
  { id: "starter", coins: 100, bonus: 0, price: 1.0, label: "Starter" },
  { id: "popular", coins: 500, bonus: 50, price: 4.5, label: "Popular", popular: true },
  { id: "value", coins: 1200, bonus: 200, price: 9.99, label: "Value" },
  { id: "ultimate", coins: 3500, bonus: 750, price: 24.99, label: "Ultimate" },
] as const;

export type CoinPackage = (typeof COIN_PACKAGES)[number];

function getOrigin(): string {
  const origin = getRequestHeader("origin");
  if (origin) return origin;
  const host = getRequestHeader("host");
  const proto = getRequestHeader("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return "https://localhost:8080";
}

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  const Stripe = (await import("stripe")).default;
  return new Stripe(key, {
    apiVersion: "2025-08-27.basil" as never,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export const createCoinCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ packageId: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }) => {
    const pkg = COIN_PACKAGES.find((p) => p.id === data.packageId);
    if (!pkg) throw new Error("Unknown coin package");

    const userId = context.userId;
    const userEmail =
      typeof context.claims?.email === "string" ? (context.claims.email as string) : undefined;

    const stripe = await getStripe();
    const origin = getOrigin();
    const totalCoins = pkg.coins + pkg.bonus;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: userEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(pkg.price * 100),
            product_data: {
              name: `${pkg.label} — ${totalCoins.toLocaleString()} coins`,
              description:
                pkg.bonus > 0
                  ? `${pkg.coins.toLocaleString()} coins + ${pkg.bonus} bonus`
                  : `${pkg.coins.toLocaleString()} coins`,
            },
          },
        },
      ],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/topup`,
      metadata: {
        userId,
        packageId: pkg.id,
        coins: String(pkg.coins),
        bonus: String(pkg.bonus),
        totalCoins: String(totalCoins),
      },
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");

    const { error: insertErr } = await supabaseAdmin.from("coin_purchase_sessions").insert({
      user_id: userId,
      package_id: pkg.id,
      stripe_session_id: session.id,
      stripe_payment_status: "unpaid",
      amount_total: Math.round(pkg.price * 100),
      currency: "usd",
    });
    if (insertErr) {
      console.error("[topup] failed to record pending session", insertErr);
    }

    return { url: session.url, sessionId: session.id };
  });

export const verifyCoinCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ sessionId: z.string().min(1).max(256) }).parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const stripe = await getStripe();

    const session = await stripe.checkout.sessions.retrieve(data.sessionId);

    if (session.metadata?.userId && session.metadata.userId !== userId) {
      throw new Error("This checkout session does not belong to you");
    }

    const packageId = session.metadata?.packageId;
    const pkg = packageId ? COIN_PACKAGES.find((p) => p.id === packageId) : undefined;
    if (!pkg) throw new Error("Unknown coin package on session");

    const credit = pkg.coins + pkg.bonus;
    const paid = session.payment_status === "paid";

    const { data: record } = await supabaseAdmin
      .from("coin_purchase_sessions")
      .select("id, credited_coins, stripe_payment_status")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (!paid) {
      if (record) {
        await supabaseAdmin
          .from("coin_purchase_sessions")
          .update({ stripe_payment_status: session.payment_status ?? "unpaid" })
          .eq("id", record.id);
      }
      return {
        paid: false,
        status: session.payment_status ?? "unpaid",
        credited: 0,
        package: pkg.label,
      };
    }

    if (record && record.credited_coins > 0) {
      const { data: w } = await supabaseAdmin
        .from("wallets")
        .select("coins")
        .eq("user_id", userId)
        .maybeSingle();
      return {
        paid: true,
        status: "paid",
        alreadyCredited: true,
        credited: record.credited_coins,
        balance: w?.coins ?? 0,
        package: pkg.label,
      };
    }

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("wallets")
      .select("coins")
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    const newBalance = (existing?.coins ?? 0) + credit;
    const { error: writeErr } = await supabaseAdmin
      .from("wallets")
      .upsert(
        { user_id: userId, coins: newBalance, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (writeErr) throw new Error(writeErr.message);

    if (record) {
      await supabaseAdmin
        .from("coin_purchase_sessions")
        .update({
          stripe_payment_status: "paid",
          credited_coins: credit,
          credited_at: new Date().toISOString(),
        })
        .eq("id", record.id);
    } else {
      await supabaseAdmin.from("coin_purchase_sessions").insert({
        user_id: userId,
        package_id: pkg.id,
        stripe_session_id: session.id,
        stripe_payment_status: "paid",
        amount_total: session.amount_total ?? Math.round(pkg.price * 100),
        currency: session.currency ?? "usd",
        credited_coins: credit,
        credited_at: new Date().toISOString(),
      });
    }

    return {
      paid: true,
      status: "paid",
      alreadyCredited: false,
      credited: credit,
      balance: newBalance,
      package: pkg.label,
    };
  });
