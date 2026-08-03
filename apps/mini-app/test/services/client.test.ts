// API_BASE_URL is a declare const injected by Taro's defineConstants at build time.
import { describe, expect, it, vi } from 'vitest';

// Mock @tarojs/taro for storage utility dependency
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  },
}));

describe('API client', () => {
  it('should export createClient function', async () => {
    const mod = await import('../../src/services/client');
    expect(typeof mod.createClient).toBe('function');
  });

  it('should export getApiBaseUrl function', async () => {
    const mod = await import('../../src/services/client');
    expect(typeof mod.getApiBaseUrl).toBe('function');
  });
});