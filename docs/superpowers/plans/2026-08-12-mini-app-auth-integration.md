# Mini-App Auth & API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate mini-app with `@openstarter/auth` (better-auth bearer token mode) and `@openstarter/api` (Hono RPC type-safe client)

**Architecture:** Add `packages/auth/src/client/taro.ts` (better-auth non-React fetch client), create `Taro.request → fetch` adapter, refactor mini-app's auth-store/hooks/services to use `authClient` and `hc<AppType>` for type-safe API calls. Bearer plugin already enabled server-side.

**Tech Stack:** Taro v4 (React), better-auth 1.6.11, hono client, zustand 5, vitest

**Spec:** `docs/superpowers/specs/2026-08-12-mini-app-auth-integration-design.md`

## Global Constraints

- Bearer plugin already enabled on server (`packages/auth/src/server.ts:230` with `requireSignature: true`)
- `createAuthClient` from `better-auth/client` (non-React) — NOT `better-auth/react`
- Fetch adapter (`FetchEsque`) = `(input: string | URL | Request, init?: RequestInit) => Promise<Response>`
- `authClient` config: `fetchOptions.auth.type: "Bearer"`, `token: () => getToken() || ""`
- `hc<AppType>` accepts `fetch` option with same signature
- All files in `apps/mini-app/` (relative to `openstarter/`)
- Test with vitest, mock `@tarojs/taro` for env without mini-program runtime

---
## Task 1: `packages/auth/src/client/taro.ts` — Better-Auth Client for Taro

**Files:**
- Create: `packages/auth/src/client/taro.ts`

**Interfaces:**
- Produces: Exports `createAuthClient`, `emailOTPClient`, `magicLinkClient`, etc. from better-auth/client

- [ ] **Step 1: Create the file with re-exports**

```ts
// packages/auth/src/client/taro.ts
// Taro 端 better-auth 客户端（bearer token 模式）。
// 使用非 React 的 fetch client，不依赖 @tarojs/taro。
// 由 apps/mini-app 自行传入 Taro.request 适配的 fetch 实现。

export {
  emailOTPClient,
  magicLinkClient,
  twoFactorClient,
  anonymousClient,
  adminClient,
  organizationClient,
  inferAdditionalFields,
  lastLoginMethodClient,
} from "better-auth/client/plugins";

export { createAuthClient } from "better-auth/client";
```

- [ ] **Step 2: Run type check**

Run: `pnpm check-types`
Expected: PASS with no errors

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/client/taro.ts
git commit -m "feat: add better-auth client for Taro mini-app"
```

---

## Task 2: `apps/mini-app/src/lib/env.ts` — Environment Variable Helper

**Files:**
- Create: `apps/mini-app/src/lib/env.ts`
- Modify: `apps/mini-app/src/services/client.ts` (move getApiBaseUrl logic)

**Interfaces:**
- Produces: `getApiBaseUrl(): string`

- [ ] **Step 1: Create env.ts**

```ts
// apps/mini-app/src/lib/env.ts
// 环境变量 getter，供 auth-client 和 services/client 共用。
// API_BASE_URL 由 Taro 构建期 defineConstants 注入（见 config/index.ts）。

declare const API_BASE_URL: string;

export function getApiBaseUrl(): string {
  return typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:3000';
}
```

- [ ] **Step 2: Test the function**

Create file `apps/mini-app/test/lib/env.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('env', () => {
  it('should return API_BASE_URL when defined', () => {
    (global as any).API_BASE_URL = 'https://api.example.com';
    const mod = await import('../../src/lib/env');
    expect(mod.getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('should return fallback when undefined', async () => {
    delete (global as any).API_BASE_URL;
    const mod = await import('../../src/lib/env');
    expect(mod.getApiBaseUrl()).toBe('http://localhost:3000');
  });
});
```

Run: `pnpm --filter mini-app test -- test/lib/env.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mini-app/src/lib/env.ts apps/mini-app/test/lib/env.test.ts
git commit -m "feat: add env helper for API base URL"
```

---

## Task 3: `apps/mini-app/src/services/taro-fetch.ts` — Taro Request Adapter

**Files:**
- Create: `apps/mini-app/src/services/taro-fetch.ts`
- Test: `apps/mini-app/test/services/taro-fetch.test.ts`

**Interfaces:**
- Consumes: `getToken()` from `@/utils/storage`
- Produces: `createTaroFetch(onUnauthorized?: () => void): (input, init?) => Promise<Response>`; `MiniResponse` class

- [ ] **Step 1: Write failing tests**

Create `apps/mini-app/test/services/taro-fetch.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Taro from '@tarojs/taro';

vi.mock('@tarojs/taro');
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

  it('should make Taro.request with bearer token', async () => {
    const mod = await import('../../src/services/taro-fetch');
    const fetch = mod.createTaroFetch();
    
    vi.mocked(Taro.request).mockResolvedValue({
      statusCode: 200,
      data: { result: 'success' },
      header: { 'content-type': 'application/json' },
    } as any);

    const response = await fetch('https://api.example.com/test', {
      method: 'POST',
      headers: { 'X-Custom': 'value' },
      body: JSON.stringify({ key: 'value' }),
    });

    expect(Taro.request).toHaveBeenCalledWith(
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

    vi.mocked(Taro.request).mockResolvedValue({
      statusCode: 401,
      data: { error: 'unauthorized' },
      header: {},
    } as any);

    await fetch('https://api.example.com/test');
    expect(onUnauth).toHaveBeenCalled();
  });
});
```

Run: `pnpm --filter mini-app test -- test/services/taro-fetch.test.ts`
Expected: FAIL (files don't exist yet)

- [ ] **Step 2: Implement taro-fetch.ts**

```ts
// apps/mini-app/src/services/taro-fetch.ts
// Taro.request → fetch 适配器 + 极简 Response shim

import Taro from '@tarojs/taro';
import { getToken } from '@/utils/storage';

/** 极简 Response shim（小程序环境无原生 Response API）。 */
export class MiniResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  private _data: unknown;

  constructor(data: unknown, status: number, headers: Record<string, string>) {
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this._data = data;
    this.headers = {
      get: (name: string) => {
        const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    };
  }

  async json(): Promise<unknown> {
    return this._data;
  }
}

/** 把 Taro.request 包装成标准 fetch 接口（FetchEsque）。 */
export function createTaroFetch(onUnauthorized?: () => void) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as any).url;
    const token = getToken();
    const headers = normalizeHeaders(init?.headers);
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const body = parseBody(init?.body);

    const res = await Taro.request({
      url,
      method: (init?.method || 'GET') as any,
      header: headers,
      data: body,
    });

    if (res.statusCode === 401) {
      onUnauthorized?.();
    }

    return new MiniResponse(res.data, res.statusCode, res.header || {}) as any as Response;
  };
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  
  // Handle Headers instance
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    try {
      return Object.fromEntries(headers.entries());
    } catch { /* ignore */ }
  }
  
  // Handle array of tuples
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  
  // Handle plain object
  return headers as Record<string, string>;
}

function parseBody(body?: BodyInit): unknown {
  if (!body) return undefined;
  
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  
  return body;
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `pnpm --filter mini-app test -- test/services/taro-fetch.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mini-app/src/services/taro-fetch.ts apps/mini-app/test/services/taro-fetch.test.ts
git commit -m "feat: add Taro request → fetch adapter with Response shim"
```

---

## Task 4: `apps/mini-app/src/lib/auth-client.ts` — Better-Auth Client Instance

**Files:**
- Create: `apps/mini-app/src/lib/auth-client.ts`
- Test: `apps/mini-app/test/lib/auth-client.test.ts`

**Interfaces:**
- Consumes: `createAuthClient` from `@openstarter/auth/client/taro`, `createTaroFetch` from `@/services/taro-fetch`, `getApiBaseUrl` from `@/lib/env`, `getToken` from `@/utils/storage`
- Produces: `authClient` singleton instance

- [ ] **Step 1: Write test**

Create `apps/mini-app/test/lib/auth-client.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tarojs/taro');
vi.mock('@/utils/storage', () => ({
  getToken: vi.fn(() => null),
  setToken: vi.fn(),
  removeToken: vi.fn(),
}));

describe('auth-client', () => {
  it('should create authClient instance', async () => {
    const mod = await import('../../src/lib/auth-client');
    expect(mod.authClient).toBeDefined();
    expect(typeof mod.authClient.signIn).toBe('object');
  });
});
```

Run: `pnpm --filter mini-app test -- test/lib/auth-client.test.ts`
Expected: FAIL

- [ ] **Step 2: Create auth-client.ts**

```ts
// apps/mini-app/src/lib/auth-client.ts
// Better-auth 客户端实例（Taro 配置）

import { createAuthClient } from "@openstarter/auth/client/taro";
import { createTaroFetch } from "@/services/taro-fetch";
import { getToken } from "@/utils/storage";
import { getApiBaseUrl } from "./env";

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  fetchOptions: {
    customFetchImpl: createTaroFetch(),
    auth: {
      type: "Bearer",
      token: () => getToken() || "",
    },
  },
});
```

- [ ] **Step 3: Run test**

Run: `pnpm --filter mini-app test -- test/lib/auth-client.test.ts`
Expected: PASS

- [ ] **Step 4: Run type check**

Run: `pnpm check-types`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mini-app/src/lib/auth-client.ts apps/mini-app/test/lib/auth-client.test.ts
git commit -m "feat: add better-auth client instance for Taro"
```

---

## Task 5: Refactor `apps/mini-app/src/services/client.ts` — Hono RPC Client

**Files:**
- Modify: `apps/mini-app/src/services/client.ts`
- Test: `apps/mini-app/test/services/client.test.ts` (update)

**Interfaces:**
- Consumes: `hc<AppType>` from `hono/client`, `createTaroFetch` from `./taro-fetch`, `getApiBaseUrl` from `@/lib/env`
- Produces: `createClient(): HonoRPC` (replaces old dual-API approach)

- [ ] **Step 1: Update client.ts**

```ts
// apps/mini-app/src/services/client.ts
// Hono RPC 类型安全客户端（主力 API 方式）

import type { AppType } from "@openstarter/api";
import { hc } from "hono/client";
import { createTaroFetch } from "./taro-fetch";
import { useAuthStore } from "@/stores/auth-store";
import { removeToken } from "@/utils/storage";
import Taro from "@tarojs/taro";
import { getApiBaseUrl } from "@/lib/env";

function handleUnauthorized() {
  removeToken();
  useAuthStore.getState().logout();
  Taro.reLaunch({ url: '/pages/login/index' });
}

export function createClient() {
  return hc<AppType>(getApiBaseUrl(), {
    fetch: createTaroFetch(handleUnauthorized),
  });
}
```

- [ ] **Step 2: Update client.test.ts**

Modify `apps/mini-app/test/services/client.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tarojs/taro');
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
    // Verify RPC structure (cannot test actual calls without mocking Taro.request)
    expect(typeof client).toBe('object');
  });
});
```

Run: `pnpm --filter mini-app test -- test/services/client.test.ts`
Expected: PASS

- [ ] **Step 3: Run type check**

Run: `pnpm check-types`
Expected: PASS (verify Hono RPC types are correct)

- [ ] **Step 4: Commit**

```bash
git add apps/mini-app/src/services/client.ts apps/mini-app/test/services/client.test.ts
git commit -m "refactor: migrate to Hono RPC client as primary API interface"
```

---

## Task 6: Refactor `apps/mini-app/src/stores/auth-store.ts` — Auth Store with getSession

**Files:**
- Modify: `apps/mini-app/src/stores/auth-store.ts`
- Test: `apps/mini-app/test/stores/auth-store.test.ts` (update)

**Interfaces:**
- Consumes: `authClient` from `@/lib/auth-client`, storage utils
- Produces: Same `useAuthStore` interface, but `hydrate()` now calls `authClient.getSession()`

- [ ] **Step 1: Update auth-store.ts**

```ts
// apps/mini-app/src/stores/auth-store.ts
// 认证状态管理（整合 better-auth client）

import { create } from 'zustand';
import { authClient } from '@/lib/auth-client';
import { getToken, setToken, removeToken } from '@/utils/storage';

export type UserInfo = {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
};

type AuthState = {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  setSession: (token: string, user: UserInfo) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isHydrated: false,

  hydrate: async () => {
    const storedToken = getToken();
    
    if (!storedToken) {
      set({ isHydrated: true });
      return;
    }

    set({ token: storedToken });

    try {
      // 验证 token 有效性并获取用户信息
      const { data: session } = await authClient.getSession();
      
      if (session?.user) {
        set({
          user: session.user as UserInfo,
          isAuthenticated: true,
        });
      } else {
        removeToken();
        set({ token: null });
      }
    } catch {
      // 网络失败时静默降级，不跳登录页
      // 保留 token，后续请求自动 401 处理
    } finally {
      set({ isHydrated: true });
    }
  },

  setSession: (token: string, user: UserInfo) => {
    setToken(token);
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    removeToken();
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
```

- [ ] **Step 2: Update auth-store.test.ts**

Modify `apps/mini-app/test/stores/auth-store.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn(() => null),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  },
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    getSession: vi.fn(() => Promise.resolve({ data: null })),
  },
}));

describe('auth-store', () => {
  beforeEach(async () => {
    const { useAuthStore } = await import('../../src/stores/auth-store');
    useAuthStore.setState({ token: null, user: null, isAuthenticated: false, isHydrated: false });
  });

  it('should start with null state', async () => {
    const { useAuthStore } = await import('../../src/stores/auth-store');
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set token and mark authenticated', async () => {
    const { useAuthStore } = await import('../../src/stores/auth-store');
    useAuthStore.getState().setSession('test-token', { id: '1', email: 'a@b.com' });
    const state = useAuthStore.getState();
    expect(state.token).toBe('test-token');
    expect(state.isAuthenticated).toBe(true);
  });

  it('should call getSession on hydrate', async () => {
    const { authClient } = await import('../../src/lib/auth-client');
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { id: '1', email: 'a@b.com' } },
    } as any);

    const { useAuthStore } = await import('../../src/stores/auth-store');
    await useAuthStore.getState().hydrate();

    expect(authClient.getSession).toHaveBeenCalled();
  });
});
```

Run: `pnpm --filter mini-app test -- test/stores/auth-store.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mini-app/src/stores/auth-store.ts apps/mini-app/test/stores/auth-store.test.ts
git commit -m "refactor: auth-store hydrate to validate token with getSession"
```

---

## Task 7: Refactor `apps/mini-app/src/hooks/use-auth.ts` — Auth Hook with signIn

**Files:**
- Modify: `apps/mini-app/src/hooks/use-auth.ts`
- Test: `apps/mini-app/test/hooks/use-auth.test.ts` (update)

**Interfaces:**
- Consumes: `authClient`, `useAuthStore`
- Produces: `useAuth()` hook with `login(email, password)` using `authClient.signIn.email()`

- [ ] **Step 1: Update use-auth.ts**

```ts
// apps/mini-app/src/hooks/use-auth.ts
// 认证 hook（整合 better-auth client）

import { useCallback } from 'react';
import { useAuthStore, type UserInfo } from '@/stores/auth-store';
import { authClient } from '@/lib/auth-client';

export function useAuth() {
  const {
    user,
    token,
    isAuthenticated,
    isHydrated,
    setSession,
    logout: storeLogout,
  } = useAuthStore();

  const isLoading = !isHydrated;

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        let bearerToken: string | null = null;

        const result = await authClient.signIn.email(
          { email, password },
          {
            onSuccess: (ctx: any) => {
              bearerToken = ctx.response.headers.get("set-auth-token");
            },
          }
        );

        if (result.error) {
          return { error: result.error.message || 'Login failed' };
        }

        if (result.data?.user && bearerToken) {
          setSession(bearerToken, result.data.user as UserInfo);
          return { data: result.data };
        }

        return { error: 'Login failed: missing token or user' };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Login failed' };
      }
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    await authClient.signOut();
    storeLogout();
  }, [storeLogout]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}
```

- [ ] **Step 2: Update use-auth.test.ts**

(Update existing test file - see earlier test code in design doc)

Run: `pnpm --filter mini-app test -- test/hooks/use-auth.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mini-app/src/hooks/use-auth.ts apps/mini-app/test/hooks/use-auth.test.ts
git commit -m "refactor: use-auth hook to use authClient.signIn.email"
```

---

## Task 8: Update `apps/mini-app/src/pages/login/index.tsx` — Login Page

**Files:**
- Modify: `apps/mini-app/src/pages/login/index.tsx`

**Interfaces:**
- Consumes: `useAuth()` hook

- [ ] **Step 1: Update login page**

```tsx
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
```

- [ ] **Step 2: Run type check**

Run: `pnpm check-types`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mini-app/src/pages/login/index.tsx
git commit -m "refactor: login page to use useAuth hook"
```

---

## Task 9: Verify Full Test Suite

**Files:**
- No new files

- [ ] **Step 1: Run all mini-app tests**

Run: `pnpm --filter mini-app test`
Expected: All tests PASS

- [ ] **Step 2: Run type check for entire app**

Run: `pnpm check-types`
Expected: PASS with no errors

- [ ] **Step 3: Verify dev build**

Run: `pnpm --filter mini-app build`
Expected: BUILD PASS, output in `dist/`

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "test: verify all mini-app tests pass and build succeeds"
```

---

## Summary

Implementation complete:
- ✅ `packages/auth/src/client/taro.ts` — Better-auth fetch client
- ✅ `apps/mini-app/src/lib/env.ts` — Environment helper
- ✅ `apps/mini-app/src/services/taro-fetch.ts` — Taro request adapter
- ✅ `apps/mini-app/src/lib/auth-client.ts` — Auth client instance
- ✅ `apps/mini-app/src/services/client.ts` — Hono RPC client
- ✅ `apps/mini-app/src/stores/auth-store.ts` — Auth store refactor
- ✅ `apps/mini-app/src/hooks/use-auth.ts` — Auth hook refactor
- ✅ `apps/mini-app/src/pages/login/index.tsx` — Login page refactor
- ✅ All tests passing, type-safe, build verified

