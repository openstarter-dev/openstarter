import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
}));

vi.mock('@tarojs/taro', () => ({
  default: {
    request: mockRequest,
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    reLaunch: vi.fn(),
  },
}));
vi.mock('@/utils/storage', () => ({
  getToken: vi.fn(() => 'test-token'),
}));
vi.mock('@/utils/storage', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

describe('taro-fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create MiniResponse with correct status and ok', async () => {
    const mod = await import('../../src/services/taro-fetch');
    const resp = new mod.MiniResponse({ message: 'ok' }, 200, { 'content-type': 'application/json' });
    expect(resp.status).toBe(200);
    expect(resp.ok).toBe(true);
    expect(await resp.json()).toEqual({ message: 'ok' });
  });

  it('should handle 4xx status', async () => {
    const mod = await import('../../src/services/taro-fetch');
    const resp = new mod.MiniResponse({ error: 'not found' }, 404, {});
    expect(resp.status).toBe(404);
    expect(resp.ok).toBe(false);
  });

  it('should get header case-insensitively', async () => {
    const mod = await import('../../src/services/taro-fetch');
    const resp = new mod.MiniResponse({}, 200, { 'Content-Type': 'application/json' });
    expect(resp.headers.get('content-type')).toBe('application/json');
    expect(resp.headers.get('Content-Type')).toBe('application/json');
  });

  it('should make Taro.request with bearer token', async () => {
    const mod = await import('../../src/services/taro-fetch');
    const fetch = mod.createTaroFetch();

    mockRequest.mockResolvedValue({
      statusCode: 200,
      data: { result: 'success' },
      header: { 'content-type': 'application/json' },
    } as any);

    const response = await fetch('https://api.example.com/test', {
      method: 'POST',
      headers: { 'X-Custom': 'value' },
      body: JSON.stringify({ key: 'value' }),
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com/test',
        method: 'POST',
        header: expect.objectContaining({
          'Authorization': 'Bearer test-token',
          'X-Custom': 'value',
        }),
      })
    );
    expect(response.status).toBe(200);
  });

  it('should call onUnauthorized on 401', async () => {
    const onUnauth = vi.fn();
    const mod = await import('../../src/services/taro-fetch');
    const fetch = mod.createTaroFetch(onUnauth);

    mockRequest.mockResolvedValue({
      statusCode: 401,
      data: { error: 'unauthorized' },
      header: {},
    } as any);

    await fetch('https://api.example.com/test');
    expect(onUnauth).toHaveBeenCalled();
  });
});