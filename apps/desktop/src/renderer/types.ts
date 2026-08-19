// apps/desktop/src/renderer/types.ts —— 类型定义

export interface AppSettings {
  launchOnStart: boolean;
  minimizeToTray: boolean;
  autoStart: boolean;
  theme: "light" | "dark" | "system";
  shortcuts: Record<string, string>;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

export interface AuthResult {
  user: AuthUser;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
  error?: unknown;
}

export interface ElectronAPI {
  platform: string;
  getVersion: () => Promise<string>;

  // 认证
  authSignInEmail: (params: {
    email: string;
    password: string;
  }) => Promise<{ code: number; message: string; data?: AuthResult }>;
  authSignInOAuth: (params: {
    provider: "google" | "github";
  }) => Promise<{ code: number; message: string; data?: AuthResult }>;
  authSignOut: () => Promise<{ code: number; message: string }>;
  authGetSession: () => Promise<{
    code: number;
    message: string;
    data?: { user: AuthUser } | null;
  }>;
  apiRequest: (request: { method: string; path: string; body?: unknown }) => Promise<ApiResponse>;

  // 文件系统
  openFile: (options?: {
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<string | null>;
  saveFile: (data: string, options?: { defaultName?: string }) => Promise<string | null>;
  readFile: (path: string) => Promise<string | null>;
  writeFile: (path: string, data: string) => Promise<boolean>;

  // 设置
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;

  // 窗口操作
  showWindow: () => Promise<void>;
  minimizeToTray: () => Promise<void>;

  // 快捷键事件监听
  onShortcut: (callback: (action: string) => void) => () => void;
  retry: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    desktop: {
      platform: string;
      retry: () => Promise<void>;
    };
  }
}
