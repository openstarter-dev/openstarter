// test/hooks/use-auth.test.ts
import { describe, expect, it, vi } from 'vitest';

// Mock react to allow useCallback outside of React component context
vi.mock('react', () => ({
  useCallback: (fn: () => unknown) => fn,
}));

// Mock @tarojs/taro for storage utility dependency
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  },
}));

// Mock the auth store to avoid React hook dependency
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    token: null,
    user: null,
    isAuthenticated: false,
    isHydrated: true,
    setSession: vi.fn(),
    logout: vi.fn(),
  })),
}));

// Mock the client to avoid API_BASE_URL and Taro import chain
vi.mock('@/services/client', () => ({
  request: vi.fn(),
}));

describe('useAuth hook', () => {
  it('should return the expected object structure', async () => {
    const mod = await import('../../src/hooks/use-auth');
    const { useAuth } = mod;

    const result = useAuth();

    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('isAuthenticated');
    expect(result).toHaveProperty('isLoading');
    expect(result).toHaveProperty('login');
    expect(result).toHaveProperty('logout');
  });

  it('should reflect initial unauthenticated state', async () => {
    const mod = await import('../../src/hooks/use-auth');
    const { useAuth } = mod;

    const result = useAuth();

    expect(result.user).toBeNull();
    expect(result.token).toBeNull();
    expect(result.isAuthenticated).toBe(false);
  });

  it('should expose login and logout as functions', async () => {
    const mod = await import('../../src/hooks/use-auth');
    const { useAuth } = mod;

    const result = useAuth();

    expect(typeof result.login).toBe('function');
    expect(typeof result.logout).toBe('function');
  });
});