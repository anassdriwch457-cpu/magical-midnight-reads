import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, clearAuthToken, getAuthToken, setAuthToken } from "@/lib/api";

interface Wallet { coins: number }

interface Session {
  access_token: string | null;
}

interface User {
  id: string;
  email?: string;
  roles?: Role[];
  /** Coin balance — supports both `coins` (legacy) and `coin_balance` (Laravel-standard). */
  coins?: number;
  coin_balance?: number;
  display_name?: string;
  user_metadata?: {
    display_name?: string;
  };
}

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

  const syncSession = (token: string | null, nextUser: User | null) => {
    setSession(token ? { access_token: token } : null);
    setUser(nextUser);
  };

  const normalizeUser = (payload: { id: string | number; email?: string; name?: string }): User => ({
    id: String(payload.id),
    email: payload.email,
    display_name: payload.name,
    user_metadata: { display_name: payload.name },
  });

  const loadUserData = async () => {
    try {
      const [walletResponse, rolesResponse] = await Promise.all([
        api.get<{ coins?: number; coin_balance?: number; balance?: number }>("/wallet/balance", { silent: true }),
        api.get<Array<{ role: Role }>>("/user/roles", { silent: true }).catch(() => []),
      ]);
      // Support multiple Laravel response shapes: { coins }, { coin_balance }, { balance }.
      const nextCoins =
        walletResponse?.coins ??
        walletResponse?.coin_balance ??
        walletResponse?.balance ??
        0;
      const nextRoles = (rolesResponse ?? []).map((x) => x.role as Role);
      setWallet({ coins: nextCoins });
      setRoles(nextRoles);
      setUser((prev) => prev ? { ...prev, coins: nextCoins, coin_balance: nextCoins, roles: nextRoles } : prev);
    } catch (err) {
      console.error("Failed to load user data", err);
      setWallet({ coins: 0 });
      setRoles([]);
    }
  };

  useEffect(() => {
    const boot = async () => {
      const token = getAuthToken();
      if (!token) {
        syncSession(null, null);
        setWallet(null);
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        const me = await api.get<{ id: string | number; email?: string; name?: string }>("/user", { silent: true });
        const nextUser = normalizeUser(me);
        syncSession(token, nextUser);
        await loadUserData();
      } catch {
        clearAuthToken();
        syncSession(null, null);
        setWallet(null);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    void boot();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const result = await api.post<{ token: string; user: { id: string | number; email?: string; name?: string } }>(
        "/login",
        { email, password },
        { anonymous: true }
      );
      setAuthToken(result.token);
      syncSession(result.token, normalizeUser(result.user));
      await loadUserData();
      return { error: null };
    } catch (error) {
      return { error: error instanceof ApiError ? error.message : "Sign in failed" };
    }
  };
  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const result = await api.post<{ token: string; user: { id: string | number; email?: string; name?: string } }>(
        "/register",
        { name: displayName, email, password, password_confirmation: password },
        { anonymous: true }
      );
      setAuthToken(result.token);
      syncSession(result.token, normalizeUser(result.user));
      await loadUserData();
      return { error: null };
    } catch (error) {
      return { error: error instanceof ApiError ? error.message : "Sign up failed" };
    }
  };
  const signOut = async () => {
    try {
      await api.post("/logout");
    } catch {
      // Ignore server logout errors; clear local session regardless.
    }
    clearAuthToken();
    syncSession(null, null);
    setWallet(null);
    setRoles([]);
  };
  const refreshWallet = async () => { if (user) await loadUserData(); };

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
