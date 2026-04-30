/**
 * Laravel Sanctum auth provider — pattern reference.
 *
 * Expects these Laravel endpoints (adjust paths to match your API):
 *   POST /login    { email, password }   -> { token, user }
 *   POST /register { name, email, password } -> { token, user }
 *   POST /logout   (auth)                -> 204
 *   GET  /user     (auth)                -> { id, name, email, ... }
 *
 * Migrate features off `src/lib/auth.tsx` (Supabase) by gradually swapping
 * `useAuth()` imports to this provider once your Laravel endpoints exist.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setAuthToken, clearAuthToken, getAuthToken, ApiError } from "@/lib/api";

export interface LaravelUser {
  id: number;
  name: string;
  email: string;
  [key: string]: unknown;
}

interface AuthCtx {
  user: LaravelUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (name: string, email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function LaravelAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LaravelUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const u = await api.get<LaravelUser>("/user");
      setUser(u);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    (async () => {
      if (getAuthToken()) await fetchUser();
      setLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { token, user: u } = await api.post<{ token: string; user: LaravelUser }>(
        "/login",
        { email, password },
        { anonymous: true }
      );
      setAuthToken(token);
      setUser(u);
      return { error: null };
    } catch (e) {
      return { error: e instanceof ApiError ? e.message : "Sign in failed" };
    }
  };

  const signUp = async (name: string, email: string, password: string) => {
    try {
      const { token, user: u } = await api.post<{ token: string; user: LaravelUser }>(
        "/register",
        { name, email, password, password_confirmation: password },
        { anonymous: true }
      );
      setAuthToken(token);
      setUser(u);
      return { error: null };
    } catch (e) {
      return { error: e instanceof ApiError ? e.message : "Sign up failed" };
    }
  };

  const signOut = async () => {
    try {
      await api.post("/logout");
    } catch {
      /* ignore */
    }
    clearAuthToken();
    setUser(null);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
        refresh: fetchUser,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLaravelAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLaravelAuth must be used inside LaravelAuthProvider");
  return ctx;
}
