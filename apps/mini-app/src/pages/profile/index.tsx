import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authMutations, profileQueries } from "@/lib/queries";
import { useAuthStore } from "@/stores/auth-store";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import "./index.scss";

export default function ProfilePage() {
  const storeUser = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profileQuery = useQuery({ ...profileQueries.detail(), enabled: isAuthenticated });
  const logout = useMutation({
    ...authMutations.logout(),
    onSuccess: () => {
      useAuthStore.getState().logout();
      Taro.reLaunch({ url: "/pages/index/index" });
    },
  });

  const user = profileQuery.data ?? storeUser;

  return (
    <ProtectedRoute>
      <Layout>
        <View className="profile">
          <View className="profile__avatar">
            <Icon type="user" size={80} color="#1677ff" />
          </View>

          <View className="profile__info">
            <Text className="profile__name">{user?.name || user?.email || "User"}</Text>
            {user?.name && <Text className="profile__email">{user.email}</Text>}
          </View>

          <View className="profile__section">
            <Text className="profile__section-title">Account</Text>
            <View className="profile__row">
              <Text className="profile__row-label">Email</Text>
              <Text className="profile__row-value">{user?.email || "-"}</Text>
            </View>
            <View className="profile__row">
              <Text className="profile__row-label">User ID</Text>
              <Text className="profile__row-value">{user?.id || "-"}</Text>
            </View>
          </View>

          <View className="profile__logout">
            <Button
              variant="secondary"
              fullWidth
              loading={logout.isPending}
              onClick={() => logout.mutate()}
            >
              Sign Out
            </Button>
          </View>
        </View>
      </Layout>
    </ProtectedRoute>
  );
}
