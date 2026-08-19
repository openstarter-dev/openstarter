import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useAuthStore } from "@/stores/auth-store";
import Layout from "@/components/Layout";
import Button from "@/components/Button";
import "./index.scss";

export default function IndexPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const handleGetStarted = () => {
    Taro.navigateTo({ url: "/pages/login/index" });
  };

  const handleViewProfile = () => {
    Taro.navigateTo({ url: "/pages/profile/index" });
  };

  return (
    <Layout>
      {isAuthenticated && user ? (
        <View className="home">
          <View className="home__welcome-card">
            <Text className="home__greeting">Welcome back</Text>
            <Text className="home__username">{user.name || user.email}</Text>
          </View>

          <View className="home__actions">
            <Button variant="secondary" fullWidth onClick={handleViewProfile}>
              View Profile
            </Button>
          </View>

          <View className="home__placeholder">
            <Text className="home__placeholder-text">
              Start building your mini-app features here.
            </Text>
          </View>
        </View>
      ) : (
        <View className="home">
          <View className="home__hero">
            <Text className="home__hero-title">openstarter</Text>
            <Text className="home__hero-desc">
              A production-ready SaaS starter. Build your mini-app on top of this template.
            </Text>
          </View>

          <View className="home__cta">
            <Button variant="primary" fullWidth onClick={handleGetStarted}>
              Get Started
            </Button>
          </View>
        </View>
      )}
    </Layout>
  );
}
