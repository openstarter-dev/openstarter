// apps/mini-app/src/stores/auth-store.ts
// 认证状态管理（整合 better-auth client）

import { create } from "zustand";
import { authClient } from "@/lib/auth-client";
import { getToken, setToken, removeToken } from "@/utils/storage";

export type UserInfo = {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
};

type AuthState = {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  setSession: (token: string, user: UserInfo) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isHydrated: false,

  hydrate: async () => {
    const storedToken = getToken();

    if (!storedToken) {
      set({ isHydrated: true });
      return;
    }

    set({ token: storedToken });

    try {
      // 验证 token 有效性并获取用户信息
      const { data: session } = await authClient.getSession();

      if (session?.user) {
        set({
          user: session.user as UserInfo,
          isAuthenticated: true,
        });
      } else {
        removeToken();
        set({ token: null });
      }
    } catch {
      // 网络失败时静默降级，不跳登录页
      // 保留 token，后续请求自动 401 处理
    } finally {
      set({ isHydrated: true });
    }
  },

  setSession: (token: string, user: UserInfo) => {
    setToken(token);
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    removeToken();
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
