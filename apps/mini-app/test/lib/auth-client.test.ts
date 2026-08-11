import { describe, it, expect, vi } from 'vitest';

vi.mock('@tarojs/taro', () => ({
  default: {
    request: vi.fn(),
    getStorageSync: vi.fn(() => null),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    reLaunch: vi.fn(),
  },
}));
vi.mock('@/utils/storage', () => ({
  getToken: vi.fn(() => null),
  setToken: vi.fn(),
  removeToken: vi.fn(),
}));

describe('auth-client', () => {
  it('should create authClient instance', async () => {
    const mod = await import('../../src/lib/auth-client');
    expect(mod.authClient).toBeDefined();
    expect(typeof mod.authClient.signIn).toBe('function');
  });

  it('should have signIn.email method', async () => {
    const mod = await import('../../src/lib/auth-client');
    expect(typeof mod.authClient.signIn.email).toBe('function');
  });

  it('should have signOut method', async () => {
    const mod = await import('../../src/lib/auth-client');
    expect(typeof mod.authClient.signOut).toBe('function');
  });
});