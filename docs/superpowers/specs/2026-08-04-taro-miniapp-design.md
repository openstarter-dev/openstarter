# Taro Mini-App 小程序模板设计

## 概述

为 openstarter monorepo 新增 `apps/mini-app` 小程序应用，使用 Taro 框架编译为微信小程序。提供一个开箱即用的启动模板，让用户后续自行决定业务方向。

## 项目定位

- 纯模板，不预设业务方向
- 提供最小可行项目结构（认证、路由、API 集成、基础 UI）
- 复用 monorepo 现有基础设施（`@openstarter/api`、`@openstarter/auth`、`@openstarter/shared`）
- 遵循 openstarter 统一的技术风格（TypeScript、Zod、immutable 模式）

## 技术栈

| 层 | 选择 | 理由 |
|---|---|---|
| 框架 | Taro v4 (React) | 最新稳定，支持 React 18/19 |
| 状态管理 | zustand | 轻量，无模板代码 |
| API 调用 | @openstarter/api (Hono RPC) | 复用现有类型安全 client |
| 认证 | @openstarter/auth | 复用 better-auth 集成 |
| 表单 | @tanstack/react-form | 与现有项目一致 |
| 类型校验 | zod | 与现有项目一致 |
| 样式 | SCSS + Taro 内置原子类 | 跨平台兼容，不绑定特定 CSS 方案 |
| 小程序平台 | 微信小程序 (weapp) | 当前仅此平台，后续可扩展 |

## 认证方案

### 邮箱密码登录 (token-based)

1. 小程序端调用 better-auth 的邮箱密码登录 API
2. 获取 session token，存入 `Taro.setStorageSync('token')`
3. 后续 API 请求通过 `Authorization: Bearer <token>` 携带
4. 401 响应时清除 token 并跳转登录页
5. 退出登录时清除 token 并跳回登录页

认证状态通过 zustand `auth-store` 管理，页面通过 `ProtectedRoute` 组件做路由守卫。

## 页面结构

```
pages/
├── index/          # 首页 — 公开/登录后差异化展示，引导用户登录或展示基础信息
├── login/          # 登录页 — 邮箱密码表单，登录后跳转首页
├── profile/        # 个人中心 — 用户信息展示、退出登录
└── webview/        # WebView 页 — 承载 H5 页面（扩展用，如协议展示、外部页面）
```

| 页面 | 权限 | 说明 |
|------|------|------|
| 首页 | 公开 / 登录后 | 登录后显示用户信息/仪表盘，未登录时引导登录 |
| 登录 | 公开 | 邮箱密码表单，登录后跳转首页 |
| 个人中心 | 需登录 | 用户信息、退出登录 |
| WebView | 需登录 | 承载 H5 页面，供后续扩展 |

## 组件规划

```
components/
├── Button/          # 按钮（主按钮/次按钮/文字按钮，loading 状态）
├── Input/           # 输入框（带 label、错误提示、密码可见切换）
├── Layout/          # 页面布局容器（安全区域适配、加载状态）
├── ProtectedRoute/  # 路由守卫（未登录跳转登录页）
└── Icon/            # 图标组件（Taro 内置图标封装）
```

每个组件结构：`组件名/index.tsx` + `组件名/index.scss`。

## API 与数据流

```
小程序页面 → Taro.request() / Hono RPC Client
                  ↓
           @openstarter/api (Hono RPC)
                  ↓
            @openstarter/auth (token 校验)
                  ↓
            @openstarter/db (数据查询)
```

### API 客户端封装 (`src/services/client.ts`)

- 基于 `@openstarter/api` 封装的 Hono RPC 类型安全客户端
- 自动从 `Taro.getStorageSync('token')` 读取 token 并注入 `Authorization: Bearer` header
- 401 响应时自动清除 token 并跳转登录页

### 环境变量

- 复用根目录 `.env` 的 `OPENSTARTER_API_URL`
- 构建期通过 Taro `defineConstants` 注入为 `API_BASE_URL`

## 状态管理

```
stores/
├── auth-store.ts    # 认证状态 (token, user, isAuthenticated, login, logout)
└── app-store.ts     # 全局应用状态 (初始化状态、应用配置)
```

使用 zustand，轻量不预设业务状态。用户后续自行扩展。

## 目录结构

```
apps/mini-app/
├── src/
│   ├── app.config.ts          # 小程序全局配置
│   ├── app.tsx                # 应用入口
│   ├── app.scss               # 全局样式
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
│   │   └── use-auth.ts        # 认证相关 hook
│   ├── services/
│   │   └── client.ts          # API 客户端封装
│   ├── stores/
│   │   ├── auth-store.ts
│   │   └── app-store.ts
│   └── utils/
│       └── storage.ts         # 存储工具封装
├── config/
│   ├── index.ts               # Taro 编译配置
│   ├── dev.ts                 # 开发环境配置
│   └── prod.ts                # 生产环境配置
├── package.json
├── tsconfig.json
├── project.config.json        # 微信开发者工具配置
├── babel.config.js
└── README.md
```

## 与 monorepo 集成

### 根 `package.json` 新增脚本

```json
{
  "dev:mini-app": "turbo -F mini-app dev",
  "build:mini-app": "turbo -F mini-app build"
}
```

### `turbo.json` 新增任务

```json
{
  "dev:mini-app": {
    "cache": false,
    "persistent": true
  },
  "build:mini-app": {
    "dependsOn": ["^build"],
    "inputs": ["$TURBO_DEFAULT$", ".env*"],
    "outputs": [".temp/**", "dist/**"]
  }
}
```

### 依赖关系

| 包 | 对接方式 |
|---|---|
| `@openstarter/api` | 直接 import Hono RPC client |
| `@openstarter/auth` | 复用 better-auth 客户端，用 `Taro.request` 替代 fetch |
| `@openstarter/shared` | 直接 import 共享类型和工具函数 |

## 不包含的内容（scope 边界）

- ❌ 不预设业务页面（如 dashboard、订单列表、内容管理）
- ❌ 不集成支付/微信登录等原生能力（用户自行按场景接入）
- ❌ 不包含 UI 组件库（保持最小依赖）
- ❌ 不包含国际化（项目已支持，但模板不预置）
- ❌ 不包含 E2E 测试（小程序测试工具链尚不成熟）
- ❌ 不做订阅/推送集成（用户后续按需加）

## 开发流程

```bash
# 安装依赖（根目录执行）
pnpm install

# 开发（HMR）
pnpm dev:mini-app

# 构建生产版本
pnpm build:mini-app

# 预览构建产物
cd apps/mini-app && taro preview --platform weapp

# 微信开发者工具打开 dist/ 目录
```