# Mini-App 认证与 API 集成设计

**日期**：2026-08-12  
**目标**：让 mini-app 正确接入 `@openstarter/auth` 和 `@openstarter/api`，使用 bearer token 模式。  
**前置设计**：[2026-08-04-taro-miniapp-design.md](./2026-08-04-taro-miniapp-design.md)（初始模板设计）

---

## 一、问题背景

### 当前 mini-app 的问题

1. **认证端点错误**：调用 `/api/auth/email-password/login`，但 API 的真实端点是 `/api/auth/sign-in/email`（better-auth 标准）
2. **没有使用 packages/auth**：手写认证逻辑，没有复用 `@openstarter/auth` 的 better-auth 客户端
3. **API 客户端不统一**：有 `createClient()` (Hono RPC) 和 `request()` 两套方案，混乱且不安全
4. **冷启动状态错误**：已登录用户重启小程序，`hydrate()` 只读 token 不验证，导致 `user=null`，首页显示未登录 UI
5. **缺少跨端一致性**：web 端用 cookie，mobile 端用 cookie + expoClient，mini-app 完全独立

### 根本原因

Mini-program 环境不支持 cookie（无浏览器存储机制），但 better-auth 的标准会话是 cookie-based。需要：
1. **服务端**：启用 bearer token 插件（已有 ✅）
2. **客户端**：用 better-auth 的 **fetch client**（非 React hooks），配合 Taro.request 适配器
3. **状态管理**：hydrate 时调用 `getSession()` 验证 token 有效性

---

## 二、设计决策

### 2.1 认证策略：Bearer Token 模式

- **客户端**：用 `better-auth/client` 的 `createAuthClient`（非 React hooks）
- **响应头**：登录成功后从 response headers 的 `set-auth-token` 提取 bearer token
- **存储**：token 存入 `Taro.setStorageSync('token')`
- **发送**：后续 API 请求通过 `Authorization: Bearer <token>` header 携带
- **验证**：hydrate 时调用 `authClient.getSession()` 验证 token 有效性

### 2.2 API 客户端：Hono RPC 为主力

- 使用 `hc<AppType>` 创建类型安全客户端（与 web/mobile 对齐）
- 实现 `Taro.request → fetch` 适配器，注入到 `hc` 的 fetch 选项
- 自动带 bearer token，401 时自动清除 token 并跳登录页
- 移除手写的 `request()` 函数

### 2.3 Auth Client 位置

在 `packages/auth/src/client/taro.ts` 新增：
- 导出 `better-auth/client` 的 `createAuthClient`
- 导出 bearer 相关 plugins
- **不依赖 `@tarojs/taro`**（Taro 依赖由 mini-app 传入 fetch 适配器）
- 模仿 `client/native.ts` 的无平台依赖策略

### 2.4 UI 组件库：暂缓

保持当前的手写组件（Button, Input, Layout, Icon），后续再完善 `packages/ui/mini-app`。

---

## 三、架构设计

### 3.1 技术栈（新增/改动）

| 包 | 角色 | 说明 |
|---|---|---|
| `@openstarter/auth/client/taro` | 新增 | Better-auth fetch client for Taro |
| `apps/mini-app/src/lib/env.ts` | 新增 | 环境变量 getter（抽出 `getApiBaseUrl`） |
| `apps/mini-app/src/lib/auth-client.ts` | 新增 | Auth client 实例化 + 配置 |
| `apps/mini-app/src/services/taro-fetch.ts` | 新增 | Taro.request → fetch 适配器 + Response shim |
| `apps/mini-app/src/services/client.ts` | 重构 | Hono RPC 客户端（移除 request()） |
| `apps/mini-app/src/stores/auth-store.ts` | 重构 | 集成 auth-client，hydrate 调用 getSession() |
| `apps/mini-app/src/hooks/use-auth.ts` | 重构 | 用 auth-client.signIn.email() 替代手写 request() |
| `apps/mini-app/src/pages/login/index.tsx` | 微调 | 用 useAuth().login() |

### 3.2 认证流程（新）

```
┌─────────────────────────────────────┐
│ app.tsx useEffect                   │
│   → authStore.hydrate()             │
│       → getToken() 从 storage 读    │
│       → authClient.getSession()     │
│           (验证 token 有效性)       │
│       → 成功：setSession(user)      │
│       → 失败：清 token              │
│   → appStore.setReady()             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ login 页                             │
│   → useAuth().login(email, pwd)    │
│       → authClient.signIn.email()   │
│           onSuccess: 从 headers     │
│           获取 set-auth-token       │
│       → setSession(token, user)     │
│   → Taro.reLaunch 到首页            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ API 请求（任何页面）                │
│   → const client = createClient()   │
│       → hc<AppType>()               │
│           fetch 参数：自动带 token  │
│   → client.user.profile.$get()      │
│       → 401：logout + 跳登录        │
└─────────────────────────────────────┘
```

### 3.3 Response Shim

小程序环境缺少 `Response` API。创建极简 shim：

```ts
class MiniResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  private _data: unknown;

  constructor(data: unknown, status: number, headers: Record<string, string>) {
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this._data = data;
    this.headers = { 
      get: (name) => headers[name.toLowerCase()] ?? null 
    };
  }

  async json() { return this._data; }
}
```

---

## 四、新增/改动的文件

### 4.1 `packages/auth/src/client/taro.ts`（新增）

```ts
// Taro 端 better-auth 客户端（bearer token 模式）。
// 使用非 React 的 fetch client，不依赖 @tarojs/taro。

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

### 4.2 `apps/mini-app/src/lib/env.ts`（新增）

```ts
// 环境变量 getter，供 auth-client 和 services/client 共用。

export function getApiBaseUrl(): string {
  return typeof API_BASE_URL !== 'undefined' 
    ? API_BASE_URL 
    : 'http://localhost:3000';
}
```

### 4.3 `apps/mini-app/src/services/taro-fetch.ts`（新增）

```ts
// Taro.request → fetch 适配器 + 极简 Response shim

import Taro from '@tarojs/taro';
import { getToken } from '@/utils/storage';

class MiniResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  private _data: unknown;

  constructor(data: unknown, status: number, headers: Record<string, string>) {
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this._data = data;
    this.headers = { 
      get: (name) => headers[name.toLowerCase()] ?? null 
    };
  }

  async json() { return this._data; }
}

export function createTaroFetch(onUnauthorized?: () => void) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.url;
    const token = getToken();
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string>),
    };

    const res = await Taro.request({
      url,
      method: (init?.method || 'GET') as any,
      header: headers,
      data: init?.body ? JSON.parse(init.body as string) : undefined,
    });

    if (res.statusCode === 401) {
      onUnauthorized?.();
    }

    return new MiniResponse(res.data, res.statusCode, res.header);
  };
}
```

### 4.4 `apps/mini-app/src/lib/auth-client.ts`（新增）

```ts
// Better-auth 客户端实例（Taro 配置）

import { createAuthClient } from "@openstarter/auth/client/taro";
import { createTaroFetch } from "@/services/taro-fetch";
import { getApiBaseUrl } from "./env";

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  fetch: createTaroFetch(),
});
```

### 4.5 `apps/mini-app/src/services/client.ts`（重构）

```ts
// Hono RPC 类型安全客户端

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

### 4.6 `apps/mini-app/src/stores/auth-store.ts`（重构）

```ts
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
          user: session.user,
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

### 4.7 `apps/mini-app/src/hooks/use-auth.ts`（重构）

```ts
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
            onSuccess: (ctx) => {
              bearerToken = ctx.response.headers.get("set-auth-token");
            },
          }
        );

        if (result.error) {
          return { error: result.error.message || 'Login failed' };
        }

        if (result.data?.user && bearerToken) {
          setSession(bearerToken, result.data.user);
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

### 4.8 `apps/mini-app/src/pages/login/index.tsx`（微调）

```tsx
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

---

## 五、测试策略

### 5.1 单元测试

| 文件 | 新增/改动测试 |
|---|---|
| `test/stores/auth-store.test.ts` | 加 `hydrate()` 与 `getSession()` 集成测试 |
| `test/hooks/use-auth.test.ts` | 改为测试 better-auth 集成，token 提取逻辑 |
| `test/lib/auth-client.test.ts` | 新增 auth-client 实例化测试 |
| `test/services/client.test.ts` | 新增 Hono RPC + fetch adapter 测试 |

### 5.2 集成测试

运行 `pnpm dev:mini-app`，手动测试场景：

1. **冷启动未登录** → 显示首页 hero，不报错
2. **登录流程** → 输入邮箱密码 → 登录成功 → 跳首页显示欢迎卡
3. **重启已登录** → 冷启动后仍显示欢迎卡（hydrate 后 user 有值）
4. **登出** → 清除 token → 跳首页显示 hero
5. **API 401** → 模拟后端返回 401 → 自动清 token + 跳登录页

---

## 六、实施清单

### Phase 1：基础设施（新增文件）
- [ ] `packages/auth/src/client/taro.ts`
- [ ] `apps/mini-app/src/lib/env.ts`
- [ ] `apps/mini-app/src/services/taro-fetch.ts`
- [ ] `apps/mini-app/src/lib/auth-client.ts`

### Phase 2：核心逻辑（重构）
- [ ] `apps/mini-app/src/services/client.ts`（改用 hc + fetch adapter，移除 request()）
- [ ] `apps/mini-app/src/stores/auth-store.ts`（加 getSession() 验证）
- [ ] `apps/mini-app/src/hooks/use-auth.ts`（改用 authClient.signIn.email()）

### Phase 3：页面改动
- [ ] `apps/mini-app/src/pages/login/index.tsx`（改用 useAuth().login()）

### Phase 4：测试
- [ ] 更新 `test/stores/auth-store.test.ts`
- [ ] 更新 `test/hooks/use-auth.test.ts`
- [ ] 新增 `test/lib/auth-client.test.ts`
- [ ] 新增 `test/services/client.test.ts`
- [ ] 运行 `pnpm --filter mini-app test`

### Phase 5：集成验证
- [ ] `pnpm dev:mini-app` 启动开发环境
- [ ] 手动测试 5 个场景（见 5.2）
- [ ] 验证 Hono RPC 类型安全有效

---

## 七、风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| `Response` API 在小程序不可用 | 中 | 用 Response shim，仅实现必要方法 |
| Taro fetch adapter 失效 | 中 | Response shim + 充分的 unit 测试 |
| 后端 bearer 配置不对 | 高 | 已验证后端已启用 bearer（`server.ts:230`） |
| token 刷新失效 | 中 | better-auth 的 bearer 自动处理，401 时重定向 |

**快速回滚**：
- 若 Phase 1-2 失败，只需删除新建文件和改动，不影响其他端
- 若后端有问题，因为 bearer 已启用，问题不大

---

## 八、参考

- [better-auth Bearer Token 文档](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/bearer.mdx)
- [前置设计：2026-08-04-taro-miniapp-design.md](./2026-08-04-taro-miniapp-design.md)
- [openstarter CLAUDE.md](../../CLAUDE.md)
