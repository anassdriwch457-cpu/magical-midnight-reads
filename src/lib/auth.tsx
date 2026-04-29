import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Wallet { coins: number }

export type Role = "user" | "admin" | "super_admin" | "manager";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  wallet: Wallet | null;
  roles: Role[];
  isAdmin: boolean;          // legacy: any staff role
  isSuperAdmin: boolean;
  isManager: boolean;
  isUploader: boolean;       // 'admin' role only (content uploader)
  canManageContent: boolean; // super_admin || admin
  canManageUsers: boolean;   // super_admin || manager
  canViewAnalytics: boolean; // super_admin || manager
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshWallet: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const [{ data: w }, { data: r }] = await Promise.all([
      supabase.from("wallets").select("coins").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setWallet(w ?? { coins: 0 });
    setRoles((r ?? []).map((x) => x.role as Role));
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadUserData(s.user.id), 0);
      } else {
        setWallet(null);
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadUserData(s.user.id);
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
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { display_name: displayName } },
    });
    return { error: error?.message ?? null };
  };
  const signOut = async () => { await supabase.auth.signOut(); };
  const refreshWallet = async () => { if (user) await loadUserData(user.id); };

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
      loading, signIn, signUp, signOut, refreshWallet,
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
