// Superwall provider（备胎）：默认不被选中（EXPO_PUBLIC_BILLING_PROVIDER 未设置
// = revenuecat）。键全可选；未选中时本模块仅被 import，不执行 SDK 初始化。
import { useEffect } from "react";
import {
  SuperwallError,
  SuperwallLoaded,
  SuperwallLoading,
  SuperwallProvider,
} from "expo-superwall";

import { env } from "./env";

let configured = false;

/** SuperwallProvider 挂载即视为可用（SDK 由 Provider 内部初始化）。 */
export const isSuperwallAvailable = (): boolean => configured;

export interface SuperwallProviderProps {
  children: React.ReactNode;
  loading?: React.ReactNode;
  error?: React.ReactNode;
  locale?: string;
}

export const Provider = ({ children, loading, error, locale }: SuperwallProviderProps) => {
  // Provider 挂载即置位：SDK 初始化由 SuperwallProvider 内部完成（zustand store），
  // 本标志只表达「已进入初始化流程」，与 RC 的同步置位语义一致。
  useEffect(() => {
    configured = true;
  }, []);

  return (
    <SuperwallProvider
      apiKeys={{
        ios: env.EXPO_PUBLIC_SUPERWALL_APPLE_API_KEY,
        android: env.EXPO_PUBLIC_SUPERWALL_GOOGLE_API_KEY,
      }}
      options={{
        localeIdentifier: locale,
        passIdentifiersToPlayStore: true,
      }}
    >
      {loading && <SuperwallLoading>{loading}</SuperwallLoading>}
      {error && <SuperwallError>{error}</SuperwallError>}
      {loading || error ? <SuperwallLoaded>{children}</SuperwallLoaded> : children}
    </SuperwallProvider>
  );
};
