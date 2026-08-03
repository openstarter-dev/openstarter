// apps/desktop/src/renderer/types.ts —— 类型定义

export interface AppSettings {
  launchOnStart: boolean;
  minimizeToTray: boolean;
  autoStart: boolean;
  theme: "light" | "dark" | "system";
  shortcuts: Record<string, string>;
}

export interface ElectronAPI {
  platform: string;
  getVersion: () => Promise<string>;
  openFile: (options?: {
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<string | null>;
  saveFile: (
    data: string,
    options?: { defaultName?: string }
  ) => Promise<string | null>;
  readFile: (path: string) => Promise<string | null>;
  writeFile: (path: string, data: string) => Promise<boolean>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  showWindow: () => Promise<void>;
  minimizeToTray: () => Promise<void>;
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