import { ReactNode, useEffect } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useAuthStore } from "@/stores/auth-store";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      Taro.reLaunch({ url: "/pages/login/index" });
    }
  }, [isHydrated, isAuthenticated]);

  if (!isHydrated) {
    return (
      <View
        style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}
      >
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
