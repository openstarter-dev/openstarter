import { safeStorage } from "electron";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

export interface TokenStore {
  get(): string | null;
  set(token: string): void;
  clear(): void;
}

export function createTokenStore(filePath: string): TokenStore {
  return {
    get() {
      try {
        if (!existsSync(filePath)) {
          return null;
        }
        const data = readFileSync(filePath);
        return safeStorage.decryptString(data);
      } catch (error) {
        console.error("[token-store] failed to decrypt token", error);
        return null;
      }
    },

    set(token: string) {
      try {
        const data = safeStorage.encryptString(token);
        writeFileSync(filePath, data);
      } catch (error) {
        console.error("[token-store] failed to encrypt token", error);
        throw error;
      }
    },

    clear() {
      try {
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      } catch (error) {
        console.error("[token-store] failed to clear token", error);
      }
    },
  };
}
