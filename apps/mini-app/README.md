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
import { request } from "@/services/client";

const { data, error } = await request<MyType>("/api/your-endpoint", {
  method: "GET",
});
```

### 添加新组件

在 `src/components/` 下创建组件目录，保持 `index.tsx` + `index.scss` 结构。

## 技术栈

| 层       | 技术                            |
| -------- | ------------------------------- |
| 框架     | Taro v4 (React)                 |
| 状态管理 | zustand                         |
| API      | @openstarter/api (Hono RPC)     |
| 认证     | @openstarter/auth (better-auth) |
| 样式     | SCSS                            |
| 平台     | 微信小程序                      |

## 关于 openstarter

openstarter 是一个全栈 SaaS 启动模板，提供 web、mobile、desktop、CLI、extension 等多端支持。本模板是 mini-app 端的启动基础。
