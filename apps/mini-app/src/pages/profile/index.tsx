import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useAuth } from "@/hooks/use-auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import "./index.scss";

export default function ProfilePage() {
  const { user, logout } = useAuth();

  // Revoke server session as well as clearing local token store
  // 登出时同步注销服务端会话并清理本地凭据
  const handleLogout = async () => {
    await logout();
    Taro.reLaunch({ url: "/pages/index/index" });
  };

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
              onClick={() => {
                void handleLogout();
              }}
            >
              Sign Out
            </Button>
          </View>
        </View>
      </Layout>
    </ProtectedRoute>
  );
}
