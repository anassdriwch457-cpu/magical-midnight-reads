import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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

export const mockPurchaseCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ packageId: z.string() }).parse)
  .handler(async ({ data, context }) => {
    const pkg = COIN_PACKAGES.find((p) => p.id === data.packageId);
    if (!pkg) return { success: false as const, error: "Unknown package" };

    const userId = context.userId;
    const credit = pkg.coins + pkg.bonus;

    // Read current balance
    const { data: existing, error: readErr } = await supabaseAdmin
      .from("wallets")
      .select("coins")
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) return { success: false as const, error: readErr.message };

    const newBalance = (existing?.coins ?? 0) + credit;

    const { error: writeErr } = await supabaseAdmin
      .from("wallets")
      .upsert(
        { user_id: userId, coins: newBalance, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (writeErr) return { success: false as const, error: writeErr.message };

    return {
      success: true as const,
      balance: newBalance,
      credited: credit,
      package: pkg.label,
    };
  });
