// apps/mini-app/src/pages/login/index.tsx
// 登录页（用 useAuth hook）

import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuth } from '@/hooks/use-auth';
import Input from '@/components/Input';
import Button from '@/components/Button';
import Layout from '@/components/Layout';
import './index.scss';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(email.trim(), password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    Taro.reLaunch({ url: '/pages/index/index' });
  };

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

        <Button
          variant="primary"
          fullWidth
          loading={loading}
          onClick={handleLogin}
        >
          Sign In
        </Button>
      </View>
    </Layout>
  );
}