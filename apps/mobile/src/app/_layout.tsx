import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PortalHost } from "@openstarter/ui-mobile";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../../global.css";

import { initAnalyticsFromEnv } from "@/lib/analytics";
import { ConfigError } from "@/components/config-error";
import { getEnv } from "@/lib/env";
import { BillingProvider } from "@/lib/use-billing";
import { useAppLocale } from "@/lib/i18n";
import { useThemePreference } from "@/lib/theme";
import { captureReferralAttribution } from "@/lib/referral-attribution";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const env = getEnv();

  useThemePreference();
  const { locale } = useAppLocale();

  useEffect(() => {
    void initAnalyticsFromEnv();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { Linking } = await import("react-native");
        const initialUrl = await Linking.getInitialURL();
        if (!initialUrl) return;
        const url = new URL(initialUrl);
        const ref = url.searchParams.get("ref");
        if (typeof ref === "string" && ref.length > 0) {
          captureReferralAttribution(ref);
        }
      } catch {
      }
    })();
  }, []);

  if (!env.ok) {
    return (
      <SafeAreaProvider>
        <ConfigError reason={env.reason} />
      </SafeAreaProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        {/* 支付策略 Provider：configure 随挂载完成；供应商由构建期 env 决定。
            须在 QueryClientProvider 之内（生命周期钩子依赖 query context）。 */}
        <BillingProvider locale={locale}>
          <Stack screenOptions={{ headerShown: false }} />
          {/* PortalHost 是 overlay 类组件（Dialog/DropdownMenu/Tooltip 等）的
              渲染宿主，须作为 providers 的最后一个子节点（react-native-reusables 约定）。 */}
          <PortalHost />
        </BillingProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
