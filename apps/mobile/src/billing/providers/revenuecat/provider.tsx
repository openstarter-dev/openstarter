// RevenueCat provider：configure 门面语义（幂等 / 缺 key 降级 / Expo Go 降级）
// 从 apps/mobile/src/lib/purchases.ts 迁入（spec §4.1）。key 走构建期 env。
import { useEffect } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

import { env } from "./env";

/**
 * 共享初始化 Promise：并发调用共享同一次 configure（幂等），identify/restore 等
 * await 它 —— 消除「identify 先于 configure 完成」的竞态（原 purchases.ts 语义）。
 */
let initPromise: Promise<boolean> | null = null;
let configured = false;

/** configure 是否成功（key 缺失 / 原生模块缺失均判定为 false）。 */
export const isRevenueCatAvailable = (): boolean => configured;

export const ensureConfigured = (): Promise<boolean> => {
  if (!initPromise) {
    initPromise = (async () => {
      const apiKey = Platform.select({
        ios: env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY,
        android: env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY,
      });

      if (!apiKey?.trim()) {
        return false;
      }

      try {
        if (__DEV__) {
          void Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        }
        // 同步置位：同 tick 内 isAvailable() 即可读 true（对齐原门面）。
        configured = true;
        Purchases.configure({ apiKey });
        return true;
      } catch {
        // configure 失败（如 Expo Go 下无原生模块）：IAP 整体降级为不可用。
        configured = false;
        return false;
      }
    })();
  }
  return initPromise;
};

export const Provider = ({ children, locale }: { children: React.ReactNode; locale?: string }) => {
  useEffect(() => {
    void ensureConfigured();
  }, []);

  useEffect(() => {
    void Purchases.overridePreferredLocale(locale ?? null);
  }, [locale]);

  return children;
};
