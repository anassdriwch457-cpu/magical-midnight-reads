import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BanSchema = z.object({
  targetUserId: z.string().uuid(),
  ban: z.boolean(),
});

/**
 * Ban or unban a user via Supabase Auth admin.
 * Only super_admin or manager can call this.
 * Banned users cannot sign in or use their existing tokens.
 */
export const setUserBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => BanSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller has super_admin or manager role
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) throw new Error(rolesErr.message);

    const allowed = (roles ?? []).some(
      (r) => r.role === "super_admin" || r.role === "manager"
    );
    if (!allowed) throw new Error("Insufficient privileges");

    // Prevent self-ban
    if (data.targetUserId === userId) {
      throw new Error("You cannot ban yourself");
    }

    const ban_duration = data.ban ? "876000h" : "none"; // ~100 years or lifted
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.targetUserId,
      { ban_duration }
    );
    if (error) throw new Error(error.message);

    return { success: true, banned: data.ban };
  });
