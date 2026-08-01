import { Redirect, Stack } from "expo-router";

import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { deriveAuthGate } from "@/lib/auth-gate";

export default function AuthLayout() {
  const { data: session, isPending } = authClient.useSession();
  const gate = deriveAuthGate({ isPending, session });

  if (gate === "loading") {
    return <Spinner />;
  }

  // 已登录的人不该看到登录页。"/" 由 (tabs)/index.tsx 承载，
  // 这里用路径而不是分组名，避免和路由组的内部命名耦合。
  if (gate === "authenticated") {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
