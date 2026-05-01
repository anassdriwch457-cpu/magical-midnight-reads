import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session as SupabaseSession, User as SupabaseUser } from "@supabase/supabase-js";

export type Role = "user" | "admin" | "super_admin" | "manager";

interface Wallet { coins: number }

interface AuthCtx {
  user: SupabaseUser | null;
  session: SupabaseSession | null;
  wallet: Wallet | null;
  roles: Role[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isManager: boolean;
  isUploader: boolean;
  canManageContent: boolean;
  canManageUsers: boolean;
  canViewAnalytics: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshWallet: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (userId: string) => {
    try {
      const [walletRes, rolesRes] = await Promise.all([
        supabase.from("wallets").select("coins").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      setWallet({ coins: walletRes.data?.coins ?? 0 });
      setRoles((rolesRes.data ?? []).map((r) => r.role as Role));
    } catch (err) {
      console.error("Failed to load user data", err);
      setWallet({ coins: 0 });
      setRoles([]);
    }
  };

  useEffect(() => {
    // Set up listener BEFORE getSession (per Supabase docs).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        // Defer to avoid deadlock inside the auth callback.
        setTimeout(() => { void loadUserData(nextSession.user.id); }, 0);
      } else {
        setWallet(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) void loadUserData(s.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: displayName },
      },
    });
    return { error: error?.message ?? null };
  };

  const signInWithGoogle = async () => {
    try {
      const { lovable } = await import("@/integrations/lovable/index");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) return { error: result.error.message ?? "Google sign-in failed" };
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Google sign-in failed" };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshWallet = async () => {
    if (user) await loadUserData(user.id);
  };

  const isSuperAdmin = roles.includes("super_admin");
  const isManager = roles.includes("manager");
  const isUploader = roles.includes("admin");
  const canManageContent = isSuperAdmin || isUploader;
  const canManageUsers = isSuperAdmin || isManager;
  const canViewAnalytics = isSuperAdmin || isManager;
  const isAdmin = isSuperAdmin || isManager || isUploader;

  return (
    <Ctx.Provider value={{
      user, session, wallet, roles,
      isAdmin, isSuperAdmin, isManager, isUploader,
      canManageContent, canManageUsers, canViewAnalytics,
      loading, signIn, signUp, signInWithGoogle, signOut, refreshWallet,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
