import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '@/stores/auth-store';
import { request } from '@/services/client';
import Input from '@/components/Input';
import Button from '@/components/Button';
import Layout from '@/components/Layout';
import './index.scss';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setSession = useAuthStore((s) => s.setSession);

  const handleLogin = async () => {
    // 基础校验
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await request<{ token: string; user: { id: string; email: string; name?: string } }>(
        '/api/auth/email-password/login',
        {
          method: 'POST',
          body: { email: email.trim(), password },
        },
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.data) {
        setSession(result.data.token, result.data.user);
        Taro.reLaunch({ url: '/pages/index/index' });
      }
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
          name="email"
        />
        <Input
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
          type="password"
          name="password"
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