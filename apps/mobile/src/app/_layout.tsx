import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../../global.css";

import { ConfigError } from "@/components/config-error";
import { getEnv } from "@/lib/env";
import { useAppLocale } from "@/lib/i18n";
import { useThemePreference } from "@/lib/theme";

export default function RootLayout() {
  // QueryClient 必须在渲染之间保持同一实例，否则每次重渲染都会丢掉全部缓存。
  const [queryClient] = useState(() => new QueryClient());
  const env = getEnv();

  // 两个钩子必须无条件调用（React hooks 规则），因此放在 env 分支之前。
  useThemePreference();
  useAppLocale();

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
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
