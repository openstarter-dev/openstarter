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

  if (gate === "authenticated") {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
