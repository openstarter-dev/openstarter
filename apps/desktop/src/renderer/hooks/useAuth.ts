// apps/desktop/src/renderer/hooks/useAuth.ts
// 认证状态管理

import { useState, useCallback } from "react";

const AUTH_TOKEN_KEY = "auth-token";

export function useAuth() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(AUTH_TOKEN_KEY)
  );

  const login = useCallback(
    async (_email: string, _password: string) => {
      // TODO: 调用 packages/auth API
      // const response = await fetch("/api/auth/login", { method: "POST", body: { email, password } });
      // const { token } = await response.json();
      // localStorage.setItem(AUTH_TOKEN_KEY, token);
      // setToken(token);
      // navigate("/");
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
  }, []);

  const isAuthenticated = token !== null;

  return { isAuthenticated, login, logout, token };
}