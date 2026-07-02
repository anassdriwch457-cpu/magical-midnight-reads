import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { COIN_PACKAGES } from "@/server/topup.functions";

/**
 * Stripe webhook receiver — production live signal endpoint.
 *
 * URL (configure this in the Stripe Dashboard → Developers → Webhooks):
 *   https://<your-domain>/api/public/stripe-webhook
 *
 * Required env vars (server-only, NEVER prefixed with VITE_):
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_WEBHOOK_SECRET   (the "whsec_..." signing secret from Stripe)
 *
 * Events handled:
 *   - checkout.session.completed   → credit coins (idempotent)
 *   - checkout.session.async_payment_succeeded
 *   - checkout.session.async_payment_failed
 *
 * Idempotency: every credit is gated on `coin_purchase_sessions.credited_coins`
 * so retries from Stripe never double-credit.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
} as const;

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  const Stripe = (await import("stripe")).default;
  return new Stripe(key, { apiVersion: "2025-08-27.basil" as never });
}

async function creditCheckoutSession(sessionId: string) {
  const stripe = await getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return { ok: true, skipped: "not_paid", status: session.payment_status };
  }

  const userId = session.metadata?.userId;
  const packageId = session.metadata?.packageId;
  if (!userId || !packageId) {
    return { ok: true, skipped: "missing_metadata" };
  }

  const pkg = COIN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return { ok: true, skipped: "unknown_package" };

  const credit = pkg.coins + pkg.bonus;

  // Idempotency check.
  const { data: record } = await supabaseAdmin
    .from("coin_purchase_sessions")
    .select("id, credited_coins")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (record && record.credited_coins > 0) {
    return { ok: true, alreadyCredited: true };
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
    const { error: trackErr } = await supabaseAdmin
      .from("coin_purchase_sessions")
      .update({
        stripe_payment_status: "paid",
        credited_coins: credit,
        credited_at: new Date().toISOString(),
      })
      .eq("id", record.id);
    if (trackErr) console.error("[stripe-webhook] failed to mark session as credited", trackErr);
  } else {
    const { error: insertErr } = await supabaseAdmin.from("coin_purchase_sessions").insert({
      user_id: userId,
      package_id: pkg.id,
      stripe_session_id: session.id,
      stripe_payment_status: "paid",
      amount_total: session.amount_total ?? Math.round(pkg.price * 100),
      currency: session.currency ?? "usd",
      credited_coins: credit,
      credited_at: new Date().toISOString(),
    });
    if (insertErr) console.error("[stripe-webhook] failed to insert session record", insertErr);
  }

  return { ok: true, credited: credit, balance: newBalance };
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
          console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
          return new Response("Webhook secret not configured", {
            status: 500,
            headers: corsHeaders,
          });
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return new Response("Missing stripe-signature header", {
            status: 400,
            headers: corsHeaders,
          });
        }

        // CRITICAL: must be the raw body for signature verification.
        const rawBody = await request.text();

        let event;
        try {
          const stripe = await getStripe();
          // constructEventAsync uses Web Crypto and works in Workers / edge runtimes.
          event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "invalid signature";
          console.error("[stripe-webhook] signature verification failed:", msg);
          return new Response(`Webhook signature verification failed: ${msg}`, {
            status: 400,
            headers: corsHeaders,
          });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded": {
              const session = event.data.object as { id: string };
              const result = await creditCheckoutSession(session.id);
              console.log(`[stripe-webhook] ${event.type}`, {
                id: session.id,
                ...result,
              });
              break;
            }
            case "checkout.session.async_payment_failed": {
              const session = event.data.object as { id: string };
              const { error: failErr } = await supabaseAdmin
                .from("coin_purchase_sessions")
                .update({ stripe_payment_status: "failed" })
                .eq("stripe_session_id", session.id);
              if (failErr)
                console.error("[stripe-webhook] failed to mark session as failed", failErr);
              break;
            }
            default:
              // Acknowledge unhandled events so Stripe doesn't retry forever.
              break;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[stripe-webhook] handler error for ${event.type}:`, msg);
          // Return 500 so Stripe retries — only for transient/internal errors.
          return new Response(`Handler error: ${msg}`, {
            status: 500,
            headers: corsHeaders,
          });
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      },
    },
  },
});
