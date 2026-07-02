import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearAuthToken, getAuthToken, setAuthToken } from "@/lib/api";

// Global fetch interceptor: attach the current Laravel bearer token to
// internal server-function calls so middleware-protected handlers receive auth.
if (
  typeof window !== "undefined" &&
  !(window as unknown as { __sfFetchPatched?: boolean }).__sfFetchPatched
) {
  (window as unknown as { __sfFetchPatched?: boolean }).__sfFetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input instanceof Request
              ? input.url
              : "";
      if (url.includes("/_serverFn/")) {
        const headers = new Headers(
          init?.headers ?? (input instanceof Request ? input.headers : undefined),
        );
        if (!headers.has("authorization")) {
          const token = getAuthToken();
          if (token) headers.set("Authorization", `Bearer ${token}`);
        }
        return originalFetch(input, { ...init, headers });
      }
    } catch (e) {
      console.error("[auth-fetch] interceptor error", e);
    }
    return originalFetch(input, init);
  };
}

export type Role = "user" | "admin" | "super_admin" | "manager";

export interface User {
  id: string;
  email: string;
  name: string;
  display_name: string;
  coin_balance: number;
}

interface Session {
  access_token: string;
}

interface Wallet {
  coins: number;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
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
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
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

  const loadUserData = async (): Promise<boolean> => {
    const token = getAuthToken();
    if (!token) {
      setSession(null);
      setUser(null);
      setWallet(null);
      setRoles([]);
      return false;
    }

    try {
      const [userRes, rolesRes, walletRes] = await Promise.all([
        api.get<User>("/user"),
        api.get<{ role: string }[]>("/user/roles"),
        api.get<{ coins: number }>("/wallet/balance"),
      ]);
      setSession({ access_token: token });
      setUser(userRes);
      setWallet({ coins: walletRes.coins ?? 0 });
      setRoles((rolesRes ?? []).map((r) => r.role as Role));
      return true;
    } catch (err) {
      console.error("Failed to load user data", err);
      clearAuthToken();
      setSession(null);
      setUser(null);
      setWallet(null);
      setRoles([]);
      return false;
    }
  };

  useEffect(() => {
    void loadUserData().finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await api.post<{ token: string; user?: User }>("/login", { email, password });
      setAuthToken(res.token);
      const hydrated = await loadUserData();
      return hydrated ? { error: null } : { error: "Signed in, but failed to load your session." };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Sign in failed" };
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const res = await api.post<{ token: string; user?: User }>("/register", {
        name: displayName,
        email,
        password,
        password_confirmation: password,
      });
      setAuthToken(res.token);
      const hydrated = await loadUserData();
      return hydrated ? { error: null } : { error: "Signed up, but failed to load your session." };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Sign up failed" };
    }
  };

  const signInWithGoogle = async () => {
    return { error: "Google sign-in is not available yet." };
  };

  const signOut = async () => {
    try {
      await api.post("/logout");
    } catch {
      // ignore logout failures; local session is cleared below
    } finally {
      clearAuthToken();
      setSession(null);
      setUser(null);
      setWallet(null);
      setRoles([]);
    }
  };

  const refreshWallet = async () => {
    if (!getAuthToken()) return;
    try {
      const walletRes = await api.get<{ coins: number }>("/wallet/balance");
      setWallet({ coins: walletRes.coins ?? 0 });
    } catch (err) {
      console.error("Failed to refresh wallet", err);
    }
  };

  const isSuperAdmin = roles.includes("super_admin");
  const isManager = roles.includes("manager");
  const isUploader = roles.includes("admin");
  const canManageContent = isSuperAdmin || isUploader;
  const canManageUsers = isSuperAdmin || isManager;
  const canViewAnalytics = isSuperAdmin || isManager;
  const isAdmin = isSuperAdmin || isManager || isUploader;

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        wallet,
        roles,
        isAdmin,
        isSuperAdmin,
        isManager,
        isUploader,
        canManageContent,
        canManageUsers,
        canViewAnalytics,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshWallet,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
