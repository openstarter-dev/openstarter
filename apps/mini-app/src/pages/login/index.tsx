import { useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useMutation } from "@tanstack/react-query";
import { authMutations } from "@/lib/queries";
import Input from "@/components/Input";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import "./index.scss";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const login = useMutation({
    ...authMutations.login(),
    onSuccess: () => {
      Taro.reLaunch({ url: "/pages/index/index" });
    },
  });

  const handleLogin = () => {
    if (!email.trim() || !password) {
      setValidationError("Please enter email and password");
      return;
    }
    setValidationError("");
    login.mutate({ email: email.trim(), password });
  };

  const error = validationError || login.error?.message || "";

  return (
    <Layout className="login-page">
      <View className="login-page__header">
        <Text className="login-page__title">openstarter</Text>
        <Text className="login-page__subtitle">Sign in to your account</Text>
      </View>

      <View className="login-page__form">
        <Input
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="your@email.com"
          type="text"
        />
        <Input
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
          type="password"
        />

        {error && <Text className="login-page__error">{error}</Text>}

        <Button variant="primary" fullWidth loading={login.isPending} onClick={handleLogin}>
          Sign In
        </Button>
      </View>
    </Layout>
  );
}
