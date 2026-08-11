import { describe, it, expect, vi } from 'vitest';

vi.mock('react', () => ({
  useCallback: (fn: () => unknown) => fn,
}));

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  },
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
    signOut: vi.fn(),
  },
}));

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

  it('should call signIn.email on login', async () => {
    const { authClient } = await import('../../src/lib/auth-client');
    const mockSignIn = authClient.signIn.email as ReturnType<typeof vi.fn>;
    mockSignIn.mockResolvedValue({
      data: { user: { id: '1', email: 'test@test.com' } },
      error: null,
    });

    const mod = await import('../../src/hooks/use-auth');
    const { useAuth } = mod;

    const result = useAuth();
    await result.login('test@test.com', 'password');

    expect(mockSignIn).toHaveBeenCalledWith(
      { email: 'test@test.com', password: 'password' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('should handle login error', async () => {
    const { authClient } = await import('../../src/lib/auth-client');
    const mockSignIn = authClient.signIn.email as ReturnType<typeof vi.fn>;
    mockSignIn.mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    });

    const mod = await import('../../src/hooks/use-auth');
    const { useAuth } = mod;

    const result = useAuth();
    const loginResult = await result.login('test@test.com', 'wrong');

    expect(loginResult.error).toBe('Invalid credentials');
  });
});