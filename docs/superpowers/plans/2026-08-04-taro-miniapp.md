# Taro Mini-App 小程序模板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Taro v4 (React) mini-program app inside `apps/mini-app` that integrates with the openstarter monorepo, provides email/password auth, and ships reusable base components and pages.

**Architecture:** Taro v4 React app targeting WeChat miniprogram, with zustand for state management, a custom Hono RPC client using `Taro.request()`, and a token-based auth flow that reuses `@openstarter/auth` on the server side.

**Tech Stack:** Taro v4, React 19, zustand, SCSS, TypeScript, Zod, `@openstarter/api` (Hono RPC), `@openstarter/auth` (better-auth)

## Global Constraints

- No i18n/internationalization — `@openstarter/i18n` must NOT be imported
- WeChat miniprogram only — do NOT install platform plugins for alipay/swan/tt/qq
- No third-party UI component library (no NutUI, TDesign, etc.)
- All styles use SCSS files, not CSS-in-JS or Tailwind
- API base URL injected via Taro `defineConstants` from `OPENSTARTER_API_URL` env var
- Token stored/retrieved via `Taro.setStorageSync`/`Taro.getStorageSync` with key `'token'`
- Auth client must use `Taro.request()` not `fetch` (not available in weapp)

---
## File Structure

```
apps/mini-app/
├── src/
│   ├── app.config.ts
│   ├── app.tsx
│   ├── app.scss
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.tsx
│   │   │   └── index.scss
│   │   ├── login/
│   │   │   ├── index.tsx
│   │   │   └── index.scss
│   │   ├── profile/
│   │   │   ├── index.tsx
│   │   │   └── index.scss
│   │   └── webview/
│   │       ├── index.tsx
│   │       └── index.scss
│   ├── components/
│   │   ├── Button/
│   │   │   ├── index.tsx
│   │   │   └── index.scss
│   │   ├── Input/
│   │   │   ├── index.tsx
│   │   │   └── index.scss
│   │   ├── Layout/
│   │   │   ├── index.tsx
│   │   │   └── index.scss
│   │   ├── ProtectedRoute/
│   │   │   └── index.tsx
│   │   └── Icon/
│   │       ├── index.tsx
│   │       └── index.scss
│   ├── hooks/
│   │   └── use-auth.ts
│   ├── services/
│   │   └── client.ts
│   ├── stores/
│   │   ├── auth-store.ts
│   │   └── app-store.ts
│   └── utils/
│       └── storage.ts
├── config/
│   ├── index.ts
│   ├── dev.ts
│   └── prod.ts
├── package.json
├── tsconfig.json
├── project.config.json
├── babel.config.js
└── README.md
```

---

### Task 1: Scaffold Project Configuration

**Files:**
- Create: `apps/mini-app/package.json`
- Create: `apps/mini-app/tsconfig.json`
- Create: `apps/mini-app/babel.config.js`
- Create: `apps/mini-app/project.config.json`
- Create: `apps/mini-app/config/index.ts`
- Create: `apps/mini-app/config/dev.ts`
- Create: `apps/mini-app/config/prod.ts`

**Interfaces:**
- Consumes: (none — first task)
- Produces: A working Taro project skeleton that `pnpm install` resolves and `taro build` can process

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "mini-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "taro build --type weapp --watch",
    "build": "taro build --type weapp",
    "test": "vitest --run",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@babel/runtime": "^7",
    "@openstarter/api": "workspace:*",
    "@openstarter/auth": "workspace:*",
    "@openstarter/shared": "workspace:*",
    "zustand": "^5",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@tarojs/cli": "^4",
    "@tarojs/taro": "^4",
    "@tarojs/plugin-platform-weapp": "^4",
    "@tarojs/react": "^4",
    "@types/react": "catalog:",
    "babel-preset-taro": "^4",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist", ".temp"]
}
```

- [ ] **Step 3: Create `babel.config.js`**

```js
// babel-preset-taro 是 Taro 官方推荐的 babel preset，处理 JSX 转换与小程序适配。
module.exports = {
  presets: [
    ['babel-preset-taro', {
      framework: 'react',
      ts: true,
    }],
  ],
};
```

- [ ] **Step 4: Create `project.config.json`**

```json
{
  "miniprogramRoot": "dist/",
  "projectname": "openstarter",
  "description": "openstarter mini-app template",
  "appid": "touristappid",
  "setting": {
    "urlCheck": true,
    "es6": false,
    "postcss": false,
    "minified": false
  },
  "compileType": "miniprogram"
}
```

- [ ] **Step 5: Create `config/index.ts`**

```typescript
import type { UserConfig } from '@tarojs/taro';

const config: UserConfig = {
  projectName: 'openstarter',
  date: '2026-8-4',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
    375: 2 / 1,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: ['@tarojs/plugin-platform-weapp'],
  defineConstants: {
    API_BASE_URL: JSON.stringify(process.env.OPENSTARTER_API_URL || 'http://localhost:3000'),
  },
  mini: {
    postcss: {
      autoprefixer: { enable: true },
      pxtransform: { enable: true, config: {} },
      url: { enable: true, config: { limit: 1024 } },
      cssModules: { enable: false, config: { namingPattern: 'module' } },
    },
  },
  h5: {
    // h5 端不会用到，但 Taro 需要编译配置存在
    publicPath: '/',
    staticDirectory: 'static',
  },
};

export default config;
```

- [ ] **Step 6: Create `config/dev.ts`**

```typescript
import type { UserConfig } from '@tarojs/taro';

const config: UserConfig = {
  logger: {
    quiet: false,
    stats: true,
  },
  mini: {},
  h5: {},
};

export default config;
```

- [ ] **Step 7: Create `config/prod.ts`**

```typescript
import type { UserConfig } from '@tarojs/taro';

const config: UserConfig = {
  mini: {
    postcss: {
      autoprefixer: { enable: true },
      pxtransform: { enable: true, config: {} },
    },
  },
  h5: {},
};

export default config;
```

- [ ] **Step 8: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
```

- [ ] **Step 9: Verify scaffold**

Run: `cd apps/mini-app && pnpm install 2>&1 | tail -5`
Expected: No errors, dependencies resolved

- [ ] **Step 10: Commit**

```bash
git add apps/mini-app/package.json apps/mini-app/tsconfig.json apps/mini-app/babel.config.js apps/mini-app/project.config.json apps/mini-app/config/
git commit -m "feat(mini-app): scaffold Taro project configuration"
```

---

### Task 2: Monorepo Integration

**Files:**
- Modify: `turbo.json`
- Modify: `package.json` (root)
- Modify: `vitest.config.ts` (root)
- Create: `apps/mini-app/vitest.config.ts`

**Interfaces:**
- Consumes: Task 1 (package.json in apps/mini-app exists)
- Produces: `pnpm dev:mini-app` and `pnpm build:mini-app` commands work

- [ ] **Step 1: Add `dev:mini-app` and `build:mini-app` tasks to `turbo.json`**

Add after the `"dev:mobile"` block (or the last `"dev:*"` task):

```json
    "dev:mini-app": {
      "cache": false,
      "persistent": true
    },
    "build:mini-app": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".temp/**", "dist/**"]
    },
```

- [ ] **Step 2: Add dev/build scripts to root `package.json`**

Add after the `"dev:mobile"` line:

```json
    "dev:mini-app": "turbo -F mini-app dev",
    "build:mini-app": "turbo -F mini-app build",
```

- [ ] **Step 3: Register mini-app in root vitest config**

Add `"apps/mini-app/vitest.config.ts"` to the `projects` array in `vitest.config.ts`:

```typescript
    projects: [
      "apps/web/vitest.config.ts",
      "apps/extension/vitest.config.ts",
      "apps/desktop/vitest.config.ts",
      "apps/mobile/vitest.config.ts",
      "apps/mini-app/vitest.config.ts",
      "packages/*/vitest.config.ts",
      "packages/*/*/vitest.config.ts",
      "scripts/vitest.config.ts",
    ],
```

- [ ] **Step 4: Verify root scripts work**

Run: `pnpm dev:mini-app --dry-run 2>&1 | tail -10`
Expected: Shows the turbo pipeline plan without errors

- [ ] **Step 5: Commit**

```bash
git add turbo.json package.json vitest.config.ts
git commit -m "feat(mini-app): add turbo tasks and root scripts for mini-app"
```

---

### Task 3: Storage Utility

**Files:**
- Create: `apps/mini-app/src/utils/storage.ts`

**Interfaces:**
- Consumes: (none)
- Produces: `export function getToken(): string | null`, `export function setToken(token: string): void`, `export function removeToken(): void`

- [ ] **Step 1: Write the test**

```typescript
// test/utils/storage.test.ts — 注意：Taro storage API 在 node 环境不可用，
// 此测试验证接口签名正确而非运行期行为。
import { describe, it, expect } from 'vitest';

describe('storage utils', () => {
  it('should export expected functions', async () => {
    const mod = await import('../src/utils/storage');
    expect(typeof mod.getToken).toBe('function');
    expect(typeof mod.setToken).toBe('function');
    expect(typeof mod.removeToken).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mini-app && npx vitest run test/utils/storage.test.ts 2>&1`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/utils/storage.ts`**

```typescript
import Taro from '@tarojs/taro';

const TOKEN_KEY = 'token';

/** 从本地存储中读取 token，不存在时返回 null。 */
export function getToken(): string | null {
  try {
    const value = Taro.getStorageSync(TOKEN_KEY);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** 将 token 写入本地存储。 */
export function setToken(token: string): void {
  Taro.setStorageSync(TOKEN_KEY, token);
}

/** 从本地存储中移除 token。 */
export function removeToken(): void {
  Taro.removeStorageSync(TOKEN_KEY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mini-app && npx vitest run test/utils/storage.test.ts 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mini-app/test/utils/storage.test.ts apps/mini-app/src/utils/storage.ts
git commit -m "feat(mini-app): add storage utility for token persistence"
```

---

### Task 4: API Client

**Files:**
- Create: `apps/mini-app/src/services/client.ts`

**Interfaces:**
- Consumes: Task 3 (`getToken`, `removeToken` from `@/utils/storage`)
- Produces: `export function createClient(): ReturnType<typeof hc>` — a Hono RPC client that uses `Taro.request()` and injects auth token

- [ ] **Step 1: Write the test**

```typescript
// test/services/client.test.ts — 注意：测试文件在 apps/mini-app/test/ 下
import { describe, it, expect } from 'vitest';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mini-app && npx vitest run test/services/client.test.ts 2>&1`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/services/client.ts`**

```typescript
import { hc } from 'hono/client';
import type { AppType } from '@openstarter/api';
import { getToken, removeToken } from '@/utils/storage';

/** 构建期由 Taro defineConstants 注入的 API 基础地址。 */
declare const API_BASE_URL: string;

/** 获取 API 基础地址（构建期注入，测试环境 fallback）。 */
export function getApiBaseUrl(): string {
  return typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:3000';
}

/** 创建一个已注入 auth token 的 Hono RPC 客户端。 */
export function createClient() {
  const token = getToken();

  return hc<AppType>(getApiBaseUrl(), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/**
 * 发送原始 API 请求（当 Hono RPC 类型不匹配时用）。
 * 自动携带 token，401 时清除 token 并跳转登录页。
 */
export async function request<TData = unknown>(
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string> } = {},
): Promise<{ data?: TData; error?: string }> {
  const token = getToken();
  const { method = 'GET', body, params } = options;

  // 构建 URL
  let url = `${getApiBaseUrl()}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  try {
    const { Taro } = await import('@tarojs/taro');
    const res = await Taro.request({
      url,
      method: method as keyof Taro.request.Method,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      data: body,
    });

    const result = res.data as { code: number; message: string; data?: TData };

    // 401 时清除 token 并跳转登录页
    if (res.statusCode === 401) {
      removeToken();
      Taro.reLaunch({ url: '/pages/login/index' });
      return { error: 'Authentication expired' };
    }

    if (result.code !== 0) {
      return { error: result.message || 'Unknown error' };
    }

    return { data: result.data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mini-app && npx vitest run test/services/client.test.ts 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mini-app/test/services/client.test.ts apps/mini-app/src/services/client.ts
git commit -m "feat(mini-app): add API client with Taro.request and auth token injection"
```

---

### Task 5: Auth Store

**Files:**
- Create: `apps/mini-app/src/stores/auth-store.ts`

**Interfaces:**
- Consumes: Task 3 (`getToken`, `setToken`, `removeToken`), Task 4 (`request`)
- Produces: `export const useAuthStore` — zustand store with `{ token, user, isAuthenticated, login, logout, hydrate }`

- [ ] **Step 1: Write the test**

```typescript
// test/stores/auth-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../src/stores/auth-store';

describe('auth-store', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null });
  });

  it('should start with null token and user', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set token and mark authenticated', () => {
    useAuthStore.getState().setSession('test-token', { id: '1', email: 'a@b.com' });
    const state = useAuthStore.getState();
    expect(state.token).toBe('test-token');
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual({ id: '1', email: 'a@b.com' });
  });

  it('should clear session on logout', () => {
    useAuthStore.getState().setSession('test-token', { id: '1', email: 'a@b.com' });
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mini-app && npx vitest run test/stores/auth-store.test.ts 2>&1`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/stores/auth-store.ts`**

```typescript
import { create } from 'zustand';
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
  /** 从持久化存储中恢复 token 并尝试获取用户信息。 */
  hydrate: () => Promise<void>;
  /** 保存会话（登录成功后调用）。 */
  setSession: (token: string, user: UserInfo) => void;
  /** 清除会话并移除 token。 */
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isHydrated: false,

  hydrate: async () => {
    const token = getToken();
    if (!token) {
      set({ isHydrated: true });
      return;
    }
    set({ token, isHydrated: true });
    // 可选：验证 token 有效性并获取用户信息
    // (后续通过 API 调用获取 profile)
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mini-app && npx vitest run test/stores/auth-store.test.ts 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mini-app/test/stores/auth-store.test.ts apps/mini-app/src/stores/auth-store.ts
git commit -m "feat(mini-app): add auth store with zustand"
```

---

### Task 6: App Store

**Files:**
- Create: `apps/mini-app/src/stores/app-store.ts`

**Interfaces:**
- Consumes: (none)
- Produces: `export const useAppStore` — zustand store with `{ isReady, setReady }`

- [ ] **Step 1: Write the test**

```typescript
// test/stores/app-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/stores/app-store';

describe('app-store', () => {
  beforeEach(() => {
    useAppStore.setState({ isReady: false });
  });

  it('should start with isReady false', () => {
    expect(useAppStore.getState().isReady).toBe(false);
  });

  it('should set isReady to true', () => {
    useAppStore.getState().setReady();
    expect(useAppStore.getState().isReady).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mini-app && npx vitest run test/stores/app-store.test.ts 2>&1`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/stores/app-store.ts`**

```typescript
import { create } from 'zustand';

type AppState = {
  /** 应用是否已完成初始化（如 storage 恢复等）。 */
  isReady: boolean;
  setReady: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  isReady: false,
  setReady: () => set({ isReady: true }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mini-app && npx vitest run test/stores/app-store.test.ts 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mini-app/test/stores/app-store.test.ts apps/mini-app/src/stores/app-store.ts
git commit -m "feat(mini-app): add app store with zustand"
```

---

### Task 7: Base Components

**Files:**
- Create: `apps/mini-app/src/components/Button/index.tsx`
- Create: `apps/mini-app/src/components/Button/index.scss`
- Create: `apps/mini-app/src/components/Input/index.tsx`
- Create: `apps/mini-app/src/components/Input/index.scss`
- Create: `apps/mini-app/src/components/Icon/index.tsx`
- Create: `apps/mini-app/src/components/Icon/index.scss`
- Create: `apps/mini-app/src/components/Layout/index.tsx`
- Create: `apps/mini-app/src/components/Layout/index.scss`
- Create: `apps/mini-app/src/components/ProtectedRoute/index.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (from Task 5)
- Produces: Reusable base components importable by pages

- [ ] **Step 1: Create `Button/index.tsx`**

```tsx
import { View, Text } from '@tarojs/components';
import './index.scss';

type ButtonVariant = 'primary' | 'secondary' | 'text';

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: 'submit' | 'button';
}

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button',
}: ButtonProps) {
  const handleClick = () => {
    if (!loading && !disabled && onClick) {
      onClick();
    }
  };

  return (
    <View
      className={cn(
        'btn',
        `btn--${variant}`,
        loading && 'btn--loading',
        disabled && 'btn--disabled',
        fullWidth && 'btn--full-width',
      )}
      onClick={handleClick}
    >
      {loading && <View className="btn__spinner" />}
      <Text className="btn__text">{children}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Create `Button/index.scss`**

```scss
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 88px;
  padding: 0 32px;
  border-radius: 16px;
  font-size: 28px;
  font-weight: 500;
  transition: opacity 0.2s;
  box-sizing: border-box;

  &--primary {
    background-color: #1677ff;
    color: #fff;
  }

  &--secondary {
    background-color: #f5f5f5;
    color: #333;
    border: 2px solid #d9d9d9;
  }

  &--text {
    background-color: transparent;
    color: #1677ff;
  }

  &--loading,
  &--disabled {
    opacity: 0.6;
  }

  &--full-width {
    width: 100%;
  }

  &__spinner {
    width: 28px;
    height: 28px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 12px;
  }

  &__text {
    vertical-align: middle;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 3: Create `Input/index.tsx`**

```tsx
import { View, Input as TaroInput, Text } from '@tarojs/components';
import './index.scss';

interface InputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
  error?: string;
  name?: string;
}

export default function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  name,
}: InputProps) {
  return (
    <View className="input-group">
      {label && <Text className="input-group__label">{label}</Text>}
      <TaroInput
        className={`input-group__input${error ? ' input-group__input--error' : ''}`}
        value={value}
        onInput={(e) => onChange(e.detail.value)}
        placeholder={placeholder}
        password={type === 'password'}
        name={name}
      />
      {error && <Text className="input-group__error">{error}</Text>}
    </View>
  );
}
```

- [ ] **Step 4: Create `Input/index.scss`**

```scss
.input-group {
  margin-bottom: 24px;

  &__label {
    display: block;
    font-size: 26px;
    color: #333;
    margin-bottom: 12px;
  }

  &__input {
    width: 100%;
    height: 80px;
    padding: 0 24px;
    border: 2px solid #d9d9d9;
    border-radius: 12px;
    font-size: 28px;
    box-sizing: border-box;
    background: #fff;

    &--error {
      border-color: #ff4d4f;
    }
  }

  &__error {
    display: block;
    font-size: 22px;
    color: #ff4d4f;
    margin-top: 8px;
  }
}
```

- [ ] **Step 5: Create `Icon/index.tsx`**

```tsx
import { View, Text } from '@tarojs/components';
import './index.scss';

interface IconProps {
  type: 'success' | 'error' | 'info' | 'arrow-right' | 'user' | 'lock' | 'logout';
  size?: number;
  color?: string;
}

export default function Icon({ type, size = 40, color }: IconProps) {
  const iconMap: Record<string, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    'arrow-right': '›',
    user: '👤',
    lock: '🔒',
    logout: '↩',
  };

  return (
    <Text
      className="icon"
      style={{
        fontSize: `${size}px`,
        ...(color ? { color } : {}),
      }}
    >
      {iconMap[type] || '?'}
    </Text>
  );
}
```

- [ ] **Step 6: Create `Icon/index.scss`**

```scss
.icon {
  display: inline-block;
  line-height: 1;
  text-align: center;
}
```

- [ ] **Step 7: Create `Layout/index.tsx`**

```tsx
import { View } from '@tarojs/components';
import { ReactNode } from 'react';
import './index.scss';

interface LayoutProps {
  children: ReactNode;
  loading?: boolean;
  className?: string;
}

export default function Layout({ children, loading = false, className = '' }: LayoutProps) {
  return (
    <View className={`layout ${className}`}>
      {loading ? (
        <View className="layout__loading">
          <View className="layout__loading-spinner" />
        </View>
      ) : (
        children
      )}
    </View>
  );
}
```

- [ ] **Step 8: Create `Layout/index.scss`**

```scss
.layout {
  min-height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  background-color: #f8f8f8;

  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
  }

  &__loading-spinner {
    width: 48px;
    height: 48px;
    border: 6px solid #e8e8e8;
    border-top-color: #1677ff;
    border-radius: 50%;
    animation: layout-spin 0.8s linear infinite;
  }
}

@keyframes layout-spin {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 9: Create `ProtectedRoute/index.tsx`**

```tsx
import { ReactNode, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '@/stores/auth-store';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      Taro.reLaunch({ url: '/pages/login/index' });
    }
  }, [isHydrated, isAuthenticated]);

  if (!isHydrated) {
    return (
      <View className="layout__loading">
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

- [ ] **Step 10: Verify build compiles**

Run: `cd apps/mini-app && npx taro build --type weapp 2>&1 | tail -10`
Expected: Build succeeds, `dist/` directory created

- [ ] **Step 11: Commit**

```bash
git add apps/mini-app/src/components/
git commit -m "feat(mini-app): add base UI components (Button, Input, Icon, Layout, ProtectedRoute)"
```

---

### Task 8: App Entry

**Files:**
- Create: `apps/mini-app/src/app.config.ts`
- Create: `apps/mini-app/src/app.tsx`
- Create: `apps/mini-app/src/app.scss`

**Interfaces:**
- Consumes: `useAuthStore`, `useAppStore` (Tasks 5, 6)
- Produces: App entry point that initializes stores and declares page routing

- [ ] **Step 1: Create `app.config.ts`**

```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/login/index',
    'pages/profile/index',
    'pages/webview/index',
  ],
  window: {
    navigationBarTitleText: 'openstarter',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f8f8f8',
  },
});
```

- [ ] **Step 2: Create `app.tsx`**

```tsx
import { useEffect, type ReactNode } from 'react';
import { useAppStore } from './stores/app-store';
import { useAuthStore } from './stores/auth-store';
import './app.scss';

interface Props {
  children: ReactNode;
}

function App({ children }: Props) {
  const setReady = useAppStore((s) => s.setReady);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    const init = async () => {
      await hydrate();
      setReady();
    };
    init();
  }, [hydrate, setReady]);

  return <>{children}</>;
}

export default App;
```

- [ ] **Step 3: Create `app.scss`**

```scss
// 全局样式重置
page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 28px;
  color: #333;
  background-color: #f8f8f8;
  box-sizing: border-box;
}

// 移除默认边距
view,
text,
input,
button {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

- [ ] **Step 4: Verify build**

Run: `cd apps/mini-app && npx taro build --type weapp 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/mini-app/src/app.config.ts apps/mini-app/src/app.tsx apps/mini-app/src/app.scss
git commit -m "feat(mini-app): add app entry with store initialization"
```

---

### Task 9: Login Page

**Files:**
- Create: `apps/mini-app/src/pages/login/index.tsx`
- Create: `apps/mini-app/src/pages/login/index.scss`

**Interfaces:**
- Consumes: `useAuthStore` (Task 5), `Input` component (Task 7), `Button` component (Task 7), `request` (Task 4)
- Produces: A login page with email/password form, on success calls `setSession` and redirects to index

- [ ] **Step 1: Create `pages/login/index.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `pages/login/index.scss`**

```scss
.login-page {
  display: flex;
  flex-direction: column;
  padding: 80px 40px;

  &__header {
    text-align: center;
    margin-bottom: 80px;
  }

  &__title {
    display: block;
    font-size: 48px;
    font-weight: 700;
    color: #1677ff;
    margin-bottom: 16px;
  }

  &__subtitle {
    display: block;
    font-size: 28px;
    color: #666;
  }

  &__form {
    width: 100%;
  }

  &__error {
    display: block;
    color: #ff4d4f;
    font-size: 24px;
    margin-bottom: 24px;
    text-align: center;
  }
}
```

- [ ] **Step 3: Verify build**

Run: `cd apps/mini-app && npx taro build --type weapp 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/mini-app/src/pages/login/
git commit -m "feat(mini-app): add login page with email/password form"
```

---

### Task 10: Index Page

**Files:**
- Create: `apps/mini-app/src/pages/index/index.tsx`
- Create: `apps/mini-app/src/pages/index/index.scss`

**Interfaces:**
- Consumes: `useAuthStore` (Task 5), `Layout` component (Task 7)
- Produces: Home page showing different content based on auth state

- [ ] **Step 1: Create `pages/index/index.tsx`**

```tsx
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '@/stores/auth-store';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import './index.scss';

export default function IndexPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const handleGetStarted = () => {
    Taro.navigateTo({ url: '/pages/login/index' });
  };

  const handleViewProfile = () => {
    Taro.navigateTo({ url: '/pages/profile/index' });
  };

  return (
    <Layout>
      {isAuthenticated && user ? (
        <View className="home">
          <View className="home__welcome-card">
            <Text className="home__greeting">Welcome back</Text>
            <Text className="home__username">{user.name || user.email}</Text>
          </View>

          <View className="home__actions">
            <Button variant="secondary" fullWidth onClick={handleViewProfile}>
              View Profile
            </Button>
          </View>

          <View className="home__placeholder">
            <Text className="home__placeholder-text">
              Start building your mini-app features here.
            </Text>
          </View>
        </View>
      ) : (
        <View className="home">
          <View className="home__hero">
            <Text className="home__hero-title">openstarter</Text>
            <Text className="home__hero-desc">
              A production-ready SaaS starter. Build your mini-app on top of this template.
            </Text>
          </View>

          <View className="home__cta">
            <Button variant="primary" fullWidth onClick={handleGetStarted}>
              Get Started
            </Button>
          </View>
        </View>
      )}
    </Layout>
  );
}
```

- [ ] **Step 2: Create `pages/index/index.scss`**

```scss
.home {
  padding: 40px 20px;

  &__hero {
    text-align: center;
    padding: 100px 0 60px;
  }

  &__hero-title {
    display: block;
    font-size: 56px;
    font-weight: 700;
    color: #1677ff;
    margin-bottom: 24px;
  }

  &__hero-desc {
    display: block;
    font-size: 28px;
    color: #666;
    line-height: 1.6;
    padding: 0 20px;
  }

  &__cta {
    padding: 0 20px;
  }

  &__welcome-card {
    background: #fff;
    border-radius: 20px;
    padding: 48px 32px;
    margin-bottom: 32px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &__greeting {
    display: block;
    font-size: 24px;
    color: #999;
    margin-bottom: 8px;
  }

  &__username {
    display: block;
    font-size: 36px;
    font-weight: 600;
    color: #333;
  }

  &__actions {
    padding: 0 0 32px;
  }

  &__placeholder {
    background: #fff;
    border-radius: 20px;
    padding: 60px 32px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &__placeholder-text {
    font-size: 26px;
    color: #bbb;
  }
}
```

- [ ] **Step 3: Verify build**

Run: `cd apps/mini-app && npx taro build --type weapp 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/mini-app/src/pages/index/
git commit -m "feat(mini-app): add index page with auth-aware landing"
```

---

### Task 11: Profile Page

**Files:**
- Create: `apps/mini-app/src/pages/profile/index.tsx`
- Create: `apps/mini-app/src/pages/profile/index.scss`

**Interfaces:**
- Consumes: `useAuthStore` (Task 5), `ProtectedRoute` (Task 7), `Layout` (Task 7), `Button` (Task 7)
- Produces: Profile page showing user info and logout button

- [ ] **Step 1: Create `pages/profile/index.tsx`**

```tsx
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '@/stores/auth-store';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import Icon from '@/components/Icon';
import './index.scss';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    Taro.reLaunch({ url: '/pages/index/index' });
  };

  return (
    <ProtectedRoute>
      <Layout>
        <View className="profile">
          <View className="profile__avatar">
            <Icon type="user" size={80} color="#1677ff" />
          </View>

          <View className="profile__info">
            <Text className="profile__name">{user?.name || user?.email || 'User'}</Text>
            {user?.name && (
              <Text className="profile__email">{user.email}</Text>
            )}
          </View>

          <View className="profile__section">
            <Text className="profile__section-title">Account</Text>
            <View className="profile__row">
              <Text className="profile__row-label">Email</Text>
              <Text className="profile__row-value">{user?.email || '-'}</Text>
            </View>
            <View className="profile__row">
              <Text className="profile__row-label">User ID</Text>
              <Text className="profile__row-value">{user?.id || '-'}</Text>
            </View>
          </View>

          <View className="profile__logout">
            <Button variant="secondary" fullWidth onClick={handleLogout}>
              Sign Out
            </Button>
          </View>
        </View>
      </Layout>
    </ProtectedRoute>
  );
}
```

- [ ] **Step 2: Create `pages/profile/index.scss`**

```scss
.profile {
  padding: 40px 20px;

  &__avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: #f0f5ff;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
  }

  &__info {
    text-align: center;
    margin-bottom: 40px;
  }

  &__name {
    display: block;
    font-size: 36px;
    font-weight: 600;
    color: #333;
    margin-bottom: 8px;
  }

  &__email {
    display: block;
    font-size: 26px;
    color: #999;
  }

  &__section {
    background: #fff;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 32px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &__section-title {
    display: block;
    font-size: 24px;
    color: #999;
    margin-bottom: 16px;
    font-weight: 500;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }
  }

  &__row-label {
    font-size: 28px;
    color: #666;
  }

  &__row-value {
    font-size: 28px;
    color: #333;
  }

  &__logout {
    padding: 40px 0;
  }
}
```

- [ ] **Step 3: Verify build**

Run: `cd apps/mini-app && npx taro build --type weapp 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/mini-app/src/pages/profile/
git commit -m "feat(mini-app): add profile page with user info and logout"
```

---

### Task 12: WebView Page

**Files:**
- Create: `apps/mini-app/src/pages/webview/index.tsx`
- Create: `apps/mini-app/src/pages/webview/index.scss`

**Interfaces:**
- Consumes: `ProtectedRoute` (Task 7)
- Produces: WebView page that loads an external URL passed via query params

- [ ] **Step 1: Create `pages/webview/index.tsx`**

```tsx
import { WebView } from '@tarojs/components';
import { useRouter } from '@tarojs/taro';
import ProtectedRoute from '@/components/ProtectedRoute';
import './index.scss';

export default function WebViewPage() {
  const router = useRouter();
  // URL 从路由参数获取，如 /pages/webview/index?url=https://example.com
  const targetUrl = router.params.url || '';

  return (
    <ProtectedRoute>
      <WebView
        className="webview"
        src={targetUrl}
      />
    </ProtectedRoute>
  );
}
```

- [ ] **Step 2: Create `pages/webview/index.scss`**

```scss
.webview {
  width: 100%;
  height: 100vh;
}
```

- [ ] **Step 3: Verify build**

Run: `cd apps/mini-app && npx taro build --type weapp 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/mini-app/src/pages/webview/
git commit -m "feat(mini-app): add webview page for external H5 content"
```

---

### Task 13: use-auth Hook

**Files:**
- Create: `apps/mini-app/src/hooks/use-auth.ts`

**Interfaces:**
- Consumes: `useAuthStore` (Task 5)
- Produces: `export function useAuth(): { user, isAuthenticated, login, logout, isLoading }`

- [ ] **Step 1: Write the test**

```typescript
// test/hooks/use-auth.test.ts
import { describe, it, expect } from 'vitest';
import { useAuthStore } from '../../src/stores/auth-store';

describe('useAuth hook', () => {
  it('should reflect auth store state', async () => {
    const mod = await import('../src/hooks/use-auth');
    const { useAuth } = mod;
    // 验证返回的对象结构
    const result = useAuth();
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('isAuthenticated');
    expect(result).toHaveProperty('login');
    expect(result).toHaveProperty('logout');
    expect(result).toHaveProperty('isLoading');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mini-app && npx vitest run test/hooks/use-auth.test.ts 2>&1`
Expected: FAIL — module not found

- [ ] **Step 3: Create `hooks/use-auth.ts`**

```typescript
import { useCallback } from 'react';
import { useAuthStore, type UserInfo } from '@/stores/auth-store';
import { request } from '@/services/client';

/**
 * 认证相关 hook，封装登录/登出逻辑和认证状态。
 * 页面组件通过此 hook 而非直接操作 store。
 */
export function useAuth() {
  const { token, user, isAuthenticated, isHydrated, setSession, logout: storeLogout } = useAuthStore();

  const isLoading = !isHydrated;

  const login = useCallback(async (email: string, password: string) => {
    const result = await request<{ token: string; user: UserInfo }>(
      '/api/auth/email-password/login',
      {
        method: 'POST',
        body: { email, password },
      },
    );

    if (result.data) {
      setSession(result.data.token, result.data.user);
    }

    return result;
  }, [setSession]);

  const logout = useCallback(() => {
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mini-app && npx vitest run test/hooks/use-auth.test.ts 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mini-app/test/hooks/use-auth.test.ts apps/mini-app/src/hooks/use-auth.ts
git commit -m "feat(mini-app): add use-auth hook"
```

---

### Task 14: README

**Files:**
- Create: `apps/mini-app/README.md`

**Interfaces:**
- Consumes: (all prior tasks complete)
- Produces: Documentation for developers using the mini-app template

- [ ] **Step 1: Create `README.md`**

```markdown
# openstarter Mini-App

Taro v4 (React) 微信小程序模板，集成 openstarter 全栈基础设施。

## 快速开始

```bash
# 确认根目录 .env 中已配置 OPENSTARTER_API_URL
pnpm install

# 开发（监听文件变化）
pnpm dev:mini-app

# 生产构建
pnpm build:mini-app
```

构建产物在 `dist/` 目录，用微信开发者工具打开即可预览。

## 项目结构

```
src/
├── app.config.ts          # 小程序全局配置
├── app.tsx                # 应用入口（store 初始化）
├── app.scss               # 全局样式
├── pages/
│   ├── index/             # 首页（公开/登录后差异化展示）
│   ├── login/             # 登录页（邮箱密码）
│   ├── profile/           # 个人中心（需登录）
│   └── webview/           # WebView 容器（需登录，?url= 参数）
├── components/
│   ├── Button/            # 按钮组件
│   ├── Input/             # 输入框组件
│   ├── Layout/            # 页面布局容器
│   ├── ProtectedRoute/    # 路由守卫组件
│   └── Icon/              # 图标组件
├── hooks/
│   └── use-auth.ts        # 认证 hook
├── services/
│   └── client.ts          # API 客户端（Taro.request + 自动携 token）
├── stores/
│   ├── auth-store.ts      # 认证状态（zustand）
│   └── app-store.ts       # 应用状态（zustand）
└── utils/
    └── storage.ts         # 存储工具（token 持久化）
```

## 认证流程

1. 用户在「登录页」填写邮箱密码
2. 调用 `/api/auth/email-password/login` 获取 token
3. token 存入 `Taro.setStorageSync('token')`
4. 后续 API 请求自动携带 `Authorization: Bearer <token>`
5. **ProtectedRoute** 组件自动检测登录状态，未登录跳转登录页
6. 退出登录清除 token 并跳转首页

## 扩展指南

### 添加新页面

1. 在 `src/pages/` 下创建页面目录（包含 `index.tsx` + `index.scss`）
2. 在 `src/app.config.ts` 的 `pages` 数组中注册
3. 需要登录保护的页面用 `<ProtectedRoute>` 包裹

### 调用 API

```typescript
import { request } from '@/services/client';

const { data, error } = await request<MyType>('/api/your-endpoint', {
  method: 'GET',
});
```

### 添加新组件

在 `src/components/` 下创建组件目录，保持 `index.tsx` + `index.scss` 结构。

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Taro v4 (React) |
| 状态管理 | zustand |
| API | @openstarter/api (Hono RPC) |
| 认证 | @openstarter/auth (better-auth) |
| 样式 | SCSS |
| 平台 | 微信小程序 |

## 关于 openstarter

openstarter 是一个全栈 SaaS 启动模板，提供 web、mobile、desktop、CLI、extension 等多端支持。本模板是 mini-app 端的启动基础。
```

- [ ] **Step 2: Commit**

```bash
git add apps/mini-app/README.md
git commit -m "docs(mini-app): add README with quick start and extension guide"
```