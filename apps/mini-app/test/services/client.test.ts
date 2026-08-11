import { describe, it, expect, vi } from 'vitest';

const { mockReLaunch } = vi.hoisted(() => ({
  mockReLaunch: vi.fn(),
}));

vi.mock('@tarojs/taro', () => ({
  default: {
    request: vi.fn(),
    getStorageSync: vi.fn(() => null),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    reLaunch: mockReLaunch,
  },
}));
vi.mock('@/utils/storage', () => ({
  getToken: vi.fn(() => null),
  removeToken: vi.fn(),
}));
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      logout: vi.fn(),
    })),
  },
}));

describe('API client', () => {
  it('should create client with Hono RPC', async () => {
    const mod = await import('../../src/services/client');
    const client = mod.createClient();
    expect(client).toBeDefined();
  });

  it('should have type-safe RPC methods', async () => {
    const mod = await import('../../src/services/client');
    const client = mod.createClient();
    // hc returns a callable proxy with route methods
    // In this test environment, the proxy is a function
    expect(typeof client).toBe('function');
  });
});