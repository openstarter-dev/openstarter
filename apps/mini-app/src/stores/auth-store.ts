import { create } from 'zustand';
import { getToken, setToken, removeToken } from '@/utils/storage';

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
  /** 从持久化存储中恢复 token 并尝试获取用户信息。 */
  hydrate: () => Promise<void>;
  /** 保存会话（登录成功后调用）。 */
  setSession: (token: string, user: UserInfo) => void;
  /** 清除会话并移除 token。 */
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isHydrated: false,

  hydrate: async () => {
    const token = getToken();
    if (!token) {
      set({ isHydrated: true });
      return;
    }
    set({ token, isHydrated: true });
    // 可选：验证 token 有效性并获取用户信息
    // (后续通过 API 调用获取 profile)
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