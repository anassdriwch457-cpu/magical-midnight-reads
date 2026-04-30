import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, clearAuthToken, getAuthToken, setAuthToken } from "@/lib/api";

export type Role = "user" | "admin" | "super_admin" | "manager";

interface User {
  id: string;
  email: string;
  name: string;
  coin_balance: number;
  roles: Role[];
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isManager: boolean;
  isUploader: boolean;
  canManageContent: boolean;
  canManageUsers: boolean;
  canViewAnalytics: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const data = await api.get<User>("/user", { silent: true });
      setUser(data);
    } catch (err) {
      console.error("Failed to fetch user", err);
      if (err instanceof ApiError && err.status === 401) {
        clearAuthToken();
      }
      setUser(null);
    }
  };

  useEffect(() => {
    const boot = async () => {
      const token = getAuthToken();
      if (token) {
        await fetchUser();
      }
      setLoading(false);
    };
    void boot();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { token, user: userData } = await api.post<{ token: string; user: User }>(
        "/login",
        { email, password },
        { anonymous: true }
      );
      setAuthToken(token);
      setUser(userData);
      return { error: null };
    } catch (error) {
      return { error: error instanceof ApiError ? error.message : "Sign in failed" };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { token, user: userData } = await api.post<{ token: string; user: User }>(
        "/register",
        { name, email, password, password_confirmation: password },
        { anonymous: true }
      );
      setAuthToken(token);
      setUser(userData);
      return { error: null };
    } catch (error) {
      return { error: error instanceof ApiError ? error.message : "Sign up failed" };
    }
  };

  const signOut = async () => {
    try {
      await api.post("/logout");
    } catch {
      // Ignore server logout errors
    } finally {
      clearAuthToken();
      setUser(null);
    }
  };

  const refreshUser = async () => {
    if (getAuthToken()) {
      await fetchUser();
    }
  };

  const roles = user?.roles ?? [];
  const isSuperAdmin = roles.includes("super_admin");
  const isManager = roles.includes("manager");
  const isUploader = roles.includes("admin");
  const isAdmin = isSuperAdmin || isManager || isUploader;
  const canManageContent = isSuperAdmin || isUploader;
  const canManageUsers = isSuperAdmin || isManager;
  const canViewAnalytics = isSuperAdmin || isManager;

  return (
    <Ctx.Provider value={{
      user,
      loading,
      isAdmin,
      isSuperAdmin,
      isManager,
      isUploader,
      canManageContent,
      canManageUsers,
      canViewAnalytics,
      signIn,
      signUp,
      signOut,
      refreshUser,
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
