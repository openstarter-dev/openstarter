# Desktop 应用认证 + UI 集成设计

日期：2026-08-12
状态：设计评审通过，待实现
基于：2026-08-04-desktop-app-redesign.md
补充：原设计 §3 假设"主进程不参与认证逻辑"，但因生产模式 `file://` 协议的 CORS 限制，渲染进程无法直接 `fetch` 远程 API。本设计将认证逻辑移至主进程，通过通用 `api:request` IPC 通道代理所有 API 调用。

## 1. 设计决策

### 核心决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 认证架构 | Bearer Token via IPC | 生产模式 `file://` 无法 CORS fetch，主进程 Node.js 无此限制 |
| 登录方式（首版） | Email + Password + OAuth (Google/GitHub) | 最小可用集，后续可扩展 |
| UI 组件 | 全量替换为 `@openstarter/ui-web` | 视觉统一，复用现有设计系统 |
| API 代理 | 通用 `api:request` IPC 通道 | 一个通道覆盖所有请求，主进程自动注入 Bearer token |
| Token 存储 | Electron `safeStorage` 加密持久化 | 比 localStorage 安全，可跨会话恢复 |
| OAuth 交互 | 内嵌 BrowserWindow 拦截回调 | 完全控制流程，可靠提取 session |
| API URL 来源 | 环境变量 + electron-builder 注入 | 构建时配置，运行时不变 |

### 与 2026-08-04 设计的差异

| 项目 | 原设计 | 本设计 | 原因 |
|------|--------|--------|------|
| 认证位置 | 渲染进程 HTTP 直接调用 `packages/auth` | 主进程 IPC 代理 | `file://` 无法 CORS fetch |
| Token 存储 | `localStorage` | `safeStorage` 加密文件 | 安全性 + 生产模式兼容性 |
| API 调用 | 渲染进程直接 `fetch` | 通用 `api:request` IPC 通道 | 跨域限制 + Bearer 自动注入 |
| OAuth 流程 | 未定义（已知限制，暂不实现） | 内嵌 BrowserWindow 拦截回调 | 首版需要 OAuth 能力 |

## 2. 新增文件清单

### 主进程新增

| 文件 | 职责 |
|------|------|
| `src/main/auth-service.ts` | 认证逻辑：signInWithEmail, signOut, getSession, handleOAuthCallback |
| `src/main/token-store.ts` | safeStorage 加密存储 access token |
| `src/main/oauth-window.ts` | 创建 BrowserWindow 处理 OAuth 流程 |
| `src/main/api-proxy.ts` | 通用 `api:request` IPC handler + Bearer 注入 |

### 渲染进程新增

| 文件 | 职责 |
|------|------|
| `src/renderer/contexts/AuthContext.tsx` | React Context 提供全局 auth 状态 |
| `src/renderer/components/RequireAuth.tsx` | 路由守卫组件 |
| `src/renderer/components/LoginForm.tsx` | 基于 @openstarter/ui-web 的登录表单 |
| `src/renderer/components/OAuthButtons.tsx` | OAuth 按钮组件 |

### 配置文件变更

| 文件 | 变更 |
|------|------|
| `apps/desktop/package.json` | 添加 `@openstarter/ui-web`, `sonner`, `next-themes` 依赖 |
| `apps/desktop/vite.config.ts` | 添加 `@tailwindcss/vite` 插件，`/api/*` proxy |
| `apps/desktop/.env` | 添加 `OPENSTARTER_API_URL` 环境变量 |
| `apps/desktop/electron-builder.yml` | 添加 `OPENSTARTER_API_URL` 注入 |

## 3. 架构

```
┌─ Renderer (React + @openstarter/ui-web) ────────────────────────┐
│                                                                   │
│  App (RouterProvider)                                             │
│  ├─ AuthProvider (React Context) — auth state + user              │
│  ├─ RequireAuth (路由守卫) — 未登录 → redirect /login             │
│  ├─ Protected Routes: /, /settings, /about                        │
│  └─ Public Routes: /login                                        │
│       │                                                           │
│       │ window.electronAPI.apiRequest()                           │
│       │ window.electronAPI.auth.*()                               │
│       ▼                                                           │
│   contextBridge (preload.ts)                                      │
└────────────────────────────┬──────────────────────────────────────┘
                             │ IPC
┌─ Main Process ─────────────┴──────────────────────────────────────┐
│                                                                    │
│  auth-service.ts   → signInWithEmail, signOut, getSession          │
│  token-store.ts    → safeStorage 加密读写 token                    │
│  oauth-window.ts   → BrowserWindow OAuth 回调拦截                   │
│  api-proxy.ts      → api:request handler + Bearer 头注入            │
│                                                                    │
│  main.ts (orchestrator) → 注册所有 IPC handlers                    │
└────────────────────────────────────────────────────────────────────┘
                             │ HTTP (Node.js http/https)
                             ▼
                    ┌─────────────────┐
                    │  packages/api    │
                    │  (Better-Auth)   │
                    └─────────────────┘
```

## 4. 主进程模块设计

### 4.1 api-proxy.ts — 通用 API 代理

渲染进程的所有 API 请求通过一个通用 IPC 通道，主进程自动注入 Bearer token。

```typescript
// IPC 通道：api:request
// 参数：{ method: string, path: string, body?: unknown }
// 返回：{ code: number, message: string, data?: unknown, error?: unknown }

ipcMain.handle("api:request", async (_event, request) => {
  const token = await tokenStore.get();
  const url = `${API_BASE_URL}${request.path}`;

  try {
    const response = await fetch(url, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: request.body ? JSON.stringify(request.body) : undefined,
    });

    // 401 → token 过期，清除并通知渲染进程
    if (response.status === 401) {
      await tokenStore.clear();
      return { code: 401, message: "session_expired" };
    }

    const data = await response.json();
    return { code: 200, message: "ok", data };
  } catch (err) {
    return { code: -1, message: "network_error", error: String(err) };
  }
});
```

### 4.2 auth-service.ts — 认证核心

```typescript
// 所有认证操作通过 api:request 通道调用 Better-Auth API

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  // 1. 通过 api:request 调 POST /api/auth/sign-in/email
  // 2. 从响应中提取 session token
  // 3. tokenStore.set(token) 加密存储
  // 4. 返回 { user }
}

export async function signInWithOAuth(
  provider: "google" | "github"
): Promise<AuthResult> {
  // 1. 调用 oauth-window.ts 打开 BrowserWindow
  // 2. 用户完成 OAuth 授权
  // 3. 拦截回调，获取 session
  // 4. tokenStore.set(token) 加密存储
  // 5. 返回 { user }
}

export async function getSession(): Promise<AuthResult | null> {
  // 1. tokenStore.get() 读取 token
  // 2. 无 token → 返回 null
  // 3. 有 token → api:request GET /api/auth/get-session
  // 4. 返回 { user } 或 null（token 过期）
}

export async function signOut(): Promise<void> {
  // 1. api:request POST /api/auth/sign-out
  // 2. tokenStore.clear()
}
```

### 4.3 token-store.ts — Token 安全存储

```typescript
// 使用 Electron safeStorage 加密 token
// 持久化到 app.getPath("userData")/auth-token.enc

export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

// 实现
// get(): safeStorage.decryptString → readFile 解码
// set(): safeStorage.encryptString → writeFile 编码
// clear(): unlink 删除文件

// 特别注意：safeStorage 在 macOS 上使用 Keychain 加密，
// 在 Windows 上使用 DPAPI，在 Linux 上使用 libsecret。
```

### 4.4 oauth-window.ts — OAuth 窗口

```typescript
export async function openOAuthWindow(
  provider: "google" | "github"
): Promise<AuthResult> {
  return new Promise((resolve, reject) => {
    // 1. 创建 BrowserWindow
    //    - 无工具栏（frame: false 或 autoHideMenuBar）
    //    - 固定大小（600x700）
    //    - 不继承父窗口 session

    // 2. 加载 OAuth URL
    //    URL: ${API_BASE_URL}/api/auth/sign-in/social
    //      ?provider=${provider}
    //      &callbackURL=openstarter://oauth-callback
    //      &errorCallbackURL=openstarter://oauth-error

    // 3. 监听 will-navigate / did-navigate
    //    - 检测到 openstarter://oauth-callback → 关闭窗口
    //    - 检测到 openstarter://oauth-error → 关闭窗口，reject

    // 4. 窗口关闭后 → 调用 getSession() 获取会话
    // 5. 提取 token → tokenStore.set(token)
    // 6. resolve({ user })
  });
}
```

### 4.5 IPC 通道清单

| Channel | 方向 | 参数 | 返回 | 说明 |
|---------|------|------|------|------|
| `api:request` | R→M | `{ method, path, body? }` | `{ code, message, data? }` | 通用 API 代理 |
| `auth:sign-in-email` | R→M | `{ email, password }` | `{ user }` 或 `{ error }` | Email 登录 |
| `auth:sign-in-oauth` | R→M | `{ provider }` | `{ user }` 或 `{ error }` | OAuth 登录 |
| `auth:sign-out` | R→M | — | `void` | 登出 |
| `auth:get-session` | R→M | — | `{ user }` 或 `null` | 会话恢复 |
| `auth:get-config` | R→M | — | `{ enabled_providers }` | 公开认证配置 |

## 5. 渲染进程 UI 设计

### 5.1 入口改造

```tsx
// main.tsx
import "@openstarter/ui-web/globals.css";
import "./styles/overrides.css";  // 桌面端特定覆盖

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
```

### 5.2 AuthContext

```tsx
// src/renderer/contexts/AuthContext.tsx
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signInOAuth: (provider: "google" | "github") => Promise<void>;
  logout: () => Promise<void>;
}
```

- 挂载时调用 `auth:get-session` 恢复会话
- `login()` → IPC `auth:sign-in-email`
- `signInOAuth()` → IPC `auth:sign-in-oauth`
- `logout()` → IPC `auth:sign-out`
- 使用 `@tanstack/react-query` 管理 session 状态

### 5.3 RequireAuth 路由守卫

```tsx
<RequireAuth>
  isLoading → <Skeleton className="size-full" />
  !isAuthenticated → <Navigate to="/login" />
  isAuthenticated → <Outlet />
</RequireAuth>
```

### 5.4 路由配置

```tsx
const router = createBrowserRouter([
  {
    path: "/login",
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: "/",
    element: <RequireAuth><RootLayout /></RequireAuth>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "about", element: <AboutPage /> },
    ],
  },
]);
```

### 5.5 LoginForm — 使用 @openstarter/ui-web 组件

```tsx
import { Button } from "@openstarter/ui-web/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openstarter/ui-web/components/card";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";

<Card>
  <CardHeader>
    <CardTitle>Sign In</CardTitle>
    <CardDescription>Enter your credentials to continue</CardDescription>
  </CardHeader>
  <CardContent>
    <form className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@example.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" placeholder="••••••••" />
      </div>
      <Button type="submit" className="w-full">Sign In</Button>
    </form>
    <div className="my-4 flex items-center gap-3 text-muted-foreground text-xs">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
    <OAuthButtons />
  </CardContent>
</Card>
```

### 5.6 OAuthButtons

```tsx
<Button variant="outline" className="w-full" onClick={() => signInOAuth("google")}>
  <GoogleIcon /> Continue with Google
</Button>
<Button variant="outline" className="w-full" onClick={() => signInOAuth("github")}>
  <GitHubIcon /> Continue with GitHub
</Button>
```

### 5.7 现有页面改造

| 文件 | 改造内容 |
|------|---------|
| `Sidebar.tsx` | 改用 `@openstarter/ui-web` 组件风格，`logout()` 调用 `useAuth().logout()` |
| `SettingsPage.tsx` | 改用 `Select`、`Checkbox`、`Button` 组件，主题切换使用 `next-themes` |
| `AboutPage.tsx` | 改用 `Card` 组件显示版本信息 |
| `DashboardPage.tsx` | 改用 `Card` 布局的欢迎页 |

## 6. 数据流

### 6.1 Email + Password 登录

```
用户输入 email/password → 点击 Sign In
  → LoginForm.handleSubmit()
  → useAuth().login(email, password)
  → IPC auth:sign-in-email { email, password }
  → Main: auth-service.signInWithEmail()
    → api-proxy: POST /api/auth/sign-in/email
    → Better-Auth 验证 → 返回 session token
    → token-store.set(token) 加密存储
  → IPC 返回 { user }
  → AuthContext 更新 user, isAuthenticated=true
  → Router 重定向 /login → /
```

### 6.2 OAuth 登录

```
用户点击 "Continue with Google"
  → useAuth().signInOAuth("google")
  → IPC auth:sign-in-oauth { provider: "google" }
  → Main: oauth-window.open("google")
    → 创建 BrowserWindow
    → 加载 OAuth URL
    → 用户授权 → 重定向到 callbackURL
    → 拦截回调 → 关闭 BrowserWindow
    → api-proxy: GET /api/auth/get-session
    → token-store.set(token)
  → IPC 返回 { user }
  → AuthContext 更新
  → Router 重定向 /login → /
```

### 6.3 会话恢复

```
App 启动 → AuthProvider mount
  → IPC auth:get-session
  → Main: token-store.get()
    → 无 token → 返回 null
    → 有 token → api-proxy: GET /api/auth/get-session
      → 有效 → 返回 { user }
      → 401 → 清除 token → 返回 null
  → 有 session → 显示受保护页面
  → 无 session → 显示 /login
```

### 6.4 业务 API 请求

```
Renderer 组件需要数据
  → window.electronAPI.apiRequest({ method: "GET", path: "/api/user/profile" })
  → IPC api:request
  → Main: 读取 token → fetch(url, { Authorization: `Bearer ${token}` })
  → 返回 JSON 响应
  → Renderer: TanStack Query 管理缓存/状态
```

## 7. 构建配置变更

### 7.1 package.json 新增依赖

```json
{
  "dependencies": {
    "@openstarter/ui-web": "workspace:*",
    "sonner": "^2.0.5",
    "next-themes": "^1.6.0"
  }
}
```

### 7.2 vite.config.ts 更新

```typescript
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "src/renderer",
  base: "./",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.OPENSTARTER_API_URL || "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

### 7.3 环境变量

```
# apps/desktop/.env
OPENSTARTER_API_URL=http://localhost:3000
OPENSTARTER_DESKTOP_DISABLE_UPDATER=true
```

### 7.4 electron-builder.yml 注入

```yaml
extraResources:
  - from: ../.env
    filter:
      - "OPENSTARTER_API_URL"
```

## 8. 安全策略

### 8.1 Token 存储安全

- 渲染进程**不持有** token（所有 API 请求通过 IPC 代理）
- 主进程使用 `safeStorage` 加密存储
- 加密数据写入 `userData/auth-token.enc`
- 登出时删除文件

### 8.2 OAuth 窗口安全

- OAuth BrowserWindow 使用独立 session（不继承父窗口）
- 仅允许导航到 OAuth provider 域名和回调 URL
- 拦截到回调 URL 后立即关闭窗口
- 不允许用户脚本注入

### 8.3 IPC 安全

- 所有 IPC 通道参数经过校验（Zod schema）
- `api:request` 的 path 限制在 `/api/*` 范围内
- 不支持任意 URL 请求（防止 SSRF）

## 9. 测试策略

### 9.1 主进程测试

| 文件 | 覆盖内容 |
|------|---------|
| `src/main/auth-service.test.ts` | Email 登录成功/失败、OAuth 流程、会话恢复、登出 |
| `src/main/token-store.test.ts` | 加密存储 round-trip、空 token、清除、文件读写异常 |
| `src/main/oauth-window.test.ts` | 窗口创建/关闭、回调拦截、超时 |
| `src/main/api-proxy.test.ts` | Bearer 注入、401 处理、网络错误、参数校验 |

### 9.2 渲染进程测试

| 文件 | 覆盖内容 |
|------|---------|
| `src/renderer/contexts/AuthContext.test.tsx` | 状态管理、登录/登出、会话恢复 |
| `src/renderer/components/RequireAuth.test.tsx` | 路由重定向、加载状态、认证通过 |
| `src/renderer/components/LoginForm.test.tsx` | 表单验证、提交、错误提示 |
| `src/renderer/components/OAuthButtons.test.tsx` | 按钮点击、provider 参数 |

### 9.3 集成测试

| 场景 | 方法 |
|------|------|
| 完整登录流程 | mock IPC → 验证 AuthContext 更新 |
| 会话恢复 | mock token-store → 验证 getSession 调用 |
| 401 自动登出 | mock api:request 返回 401 → 验证 token 清除 |
| OAuth 窗口关闭 | mock oauth-window → 验证 session 获取 |

## 10. 验收清单

1. `pnpm dev:desktop` 启动，渲染进程加载正常，热更新可用
2. Email + Password 登录成功，跳转到 dashboard
3. Google OAuth 登录成功，内嵌 BrowserWindow 正常关闭
4. GitHub OAuth 登录成功，内嵌 BrowserWindow 正常关闭
5. 登录失败（错误密码）显示错误提示
6. 关闭应用重新打开，会话自动恢复（无需重新登录）
7. 登出后清除 token，重定向到 /login
8. 未登录时输入 /settings 或 /about 自动跳转到 /login
9. 设置页（主题/托盘/自启）使用 @openstarter/ui-web 组件，读写正常
10. 关于页显示版本号
11. `pnpm test` 通过全部测试
12. `pnpm package:desktop` 产出安装包