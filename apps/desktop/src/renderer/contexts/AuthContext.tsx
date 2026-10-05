// apps/desktop/src/renderer/contexts/AuthContext.tsx —— 认证上下文

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signInOAuth: (provider: "google" | "github") => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session on mount. NOTE: optional chaining alone is NOT enough here —
    // if window.electronAPI is missing (preload failed), `a?.b()?.then()` short-circuits
    // to undefined and `finally` never runs, leaving isLoading stuck on true forever
    // (RequireAuth then shows a text-less skeleton on the dark window = "black screen").
    // Guard explicitly so loading always resolves.
    const api = window.electronAPI;
    if (!api) {
      setIsLoading(false);
      return;
    }
    api
      .authGetSession()
      .then((session) => {
        if (session?.data?.user) {
          setUser(session.data.user);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await window.electronAPI.authSignInEmail({ email, password });
    // NOTE: previously a non-200 result (e.g. wrong password) resolved silently —
    // LoginForm only shows errors on throw, so the user saw "nothing happens".
    // Always throw here so the failure reason reaches the UI.
    if (result.code !== 200 || !result.data?.user) {
      throw new Error(result.message || "Sign-in failed");
    }
    setUser(result.data.user);
  }, []);

  const signInOAuth = useCallback(async (provider: "google" | "github") => {
    const result = await window.electronAPI.authSignInOAuth({ provider });
    if (result.code !== 200 || !result.data?.user) {
      throw new Error(result.message || "OAuth sign-in failed");
    }
    setUser(result.data.user);
  }, []);

  const logout = useCallback(async () => {
    await window.electronAPI.authSignOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signInOAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
