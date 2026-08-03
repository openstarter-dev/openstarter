import { create } from 'zustand';

type AppState = {
  /** 应用是否已完成初始化（如 storage 恢复等）。 */
  isReady: boolean;
  setReady: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  isReady: false,
  setReady: () => set({ isReady: true }),
}));