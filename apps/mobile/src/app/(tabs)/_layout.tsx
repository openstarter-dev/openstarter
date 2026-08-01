import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { deriveAuthGate } from "@/lib/auth-gate";
import { m } from "@/paraglide/messages.js";

export default function TabsLayout() {
  const { data: session, isPending } = authClient.useSession();
  const gate = deriveAuthGate({ isPending, session });

  if (gate === "loading") {
    return <Spinner />;
  }

  if (gate === "unauthenticated") {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="home-outline" size={size} />
          ),
          title: m["common.nav.home"](),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="person-outline" size={size} />
          ),
          title: m["common.nav.profile"](),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="settings-outline" size={size} />
          ),
          title: m["common.nav.settings"](),
        }}
      />
    </Tabs>
  );
}
