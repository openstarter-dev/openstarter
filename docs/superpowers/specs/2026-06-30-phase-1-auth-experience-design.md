# Phase 1 — 认证体验（Auth Experience）设计

状态：已批准，待实现
日期：2026-06-30
适用分支：基于当前主干（Phase 0 外壳已完成）

## 背景

openstarter 是一个面向 Indie SaaS 的启动模板。Phase 0「外壳」已完成：营销站、
邮箱密码登录、受保护的 `_app` 路由（dashboard + settings 占位）。本阶段按路线图
推进 **Phase 1 认证体验**，把模板的认证能力补成一套克隆即用的完整方案。

技术栈锚点：TanStack Start + TanStack Router（文件路由）、Hono RPC（`/api/*`）、
Better-Auth 1.6.11（drizzle adapter，SQLite/Turso）、shadcn/Base UI、Tailwind v4、
TanStack Form + zod + sonner。

## 目标范围

本阶段交付以下认证能力：

- 密码重置（邮件链接）
- 邮箱验证（**完全可选**：提供能力，但不门禁、不提醒；留开关）
- OAuth 社交登录：**Google、GitHub、Apple**
- 匿名登录（含「匿名 → 正式账户」升级钩子）
- Google One Tap
- Magic Link（邮箱魔法链接登录）
- 邮箱 OTP（6 位验证码登录）
- 完整账户设置：资料（仅昵称，头像延后）、改密码、改邮箱、关联账户管理、
  会话管理、删除账户
- 最小事务发信能力（为上述邮件类功能托底，Phase 2 再扩展为完整 React Email 模板）

### 明确不在本阶段范围

- 头像上传 / 文件存储（延后到后续阶段）
- 完整 React Email 模板体系（Phase 2）
- 短信 / 手机 OTP（需付费短信服务商，本期只做邮箱 OTP）
- 强制邮箱验证的门禁与提醒条（仅留配置开关，默认关闭）

## 关键架构决策

1. **发信能力独立成包** `packages/email`：单一 `send` 接口 + Resend 驱动 +
   开发用 console 驱动。`packages/auth` 依赖它。Phase 2 在此包内扩展模板，接口不变。
2. **账户设置用嵌套子路由** `/settings/{profile,security,accounts,sessions,danger}`，
   设置外壳提供二级导航 + `<Outlet/>`。每文件单一职责。
3. **`createAuth()` 集中配置，按环境变量条件注册**：未配置的 provider/插件自动跳过，
   克隆者只配自己要用的，零报错。
4. **社交按钮可用性用编译期 `VITE_` 布尔控制**（简单、无额外请求），未启用的 provider
   不渲染按钮。

## 模块设计

### 1. `packages/email`（新包）

```
packages/email/
├── src/
│   ├── index.ts        # createMailer() 工厂；导出 Mailer 类型
│   ├── env.ts          # zod 校验 RESEND_API_KEY / EMAIL_FROM（均可选）
│   └── drivers/
│       ├── resend.ts   # Resend 实现
│       └── console.ts  # 开发用：邮件打到 console
```

接口：

```ts
type SendEmailInput = { to: string; subject: string; html: string; text?: string };
type Mailer = { send(input: SendEmailInput): Promise<void> };
```

驱动选择规则：配了 `RESEND_API_KEY` → Resend 驱动；否则 → console 驱动（开发/演示
零配置即可跑，重置链接等直接打印到终端）。`send` 接口在 Phase 2 不变。

### 2. `packages/auth` 改造

`createAuth()` 内部 `createMailer()` 并以依赖注入方式提供给各回调。集中配置、条件注册：

- **社交登录** `socialProviders`：google / github / apple，仅当对应
  `*_CLIENT_ID` + `*_CLIENT_SECRET`（Apple 还需 bundle identifier 等）齐全时注册。
- **密码重置**：`emailAndPassword.sendResetPassword` → 调用 mailer 发重置链接。
- **邮箱验证**：`emailVerification.sendVerificationEmail` → 发验证链接；
  `requireEmailVerification` 由配置常量控制，默认 `false`。
- **改邮箱**：`user.changeEmail.enabled = true`，`sendChangeEmailVerification` 发确认邮件
  到新邮箱。
- **删除账户**：`user.deleteUser.enabled = true`。
- **插件**：`anonymous({ onLinkAccount })`、`magicLink({ sendMagicLink })`、
  `emailOTP({ sendVerificationOTP })`、`oneTap()`（仅在配置 Google client id 时启用）。

**匿名升级**：`anonymous` 的 `onLinkAccount` 钩子，在匿名用户后续以正式方式登录/注册
时触发。模板提供空实现 + 注释，标明克隆者在此接入自己的数据迁移逻辑。

#### 配置开关（集中一处，如 `packages/auth/src/auth.config.ts`）

- `REQUIRE_EMAIL_VERIFICATION = false`（改 `true` 即强制验证）
- `ALLOW_ANONYMOUS = true`
- `MAGIC_LINK_EXPIRES_IN`、`OTP_EXPIRES_IN` 等时效常量

### 3. 数据库 schema

Better-Auth 核心表（`user` / `session` / `account` / `verification`）已齐全，
匿名 / magicLink / emailOTP / oneTap 复用现有表，**预计无需新增表**。实现时以
`db:generate` 的输出为准；若某插件要求额外字段，按输出补 migration。

### 4. API 层

`/api/auth/*` 已挂载完整 Better-Auth handler，新增 provider/插件经此 catch-all
**自动暴露**，`packages/api` 基本无需改动。

### 5. 认证客户端 `apps/web/src/lib/auth-client.ts`

挂载与服务端对应的客户端插件：

```ts
createAuthClient({
  plugins: [
    anonymousClient(),
    magicLinkClient(),
    emailOTPClient(),
    // oneTapClient 仅在配置 VITE_GOOGLE_CLIENT_ID 时挂载
  ],
});
```

### 6. 认证页 `apps/web/src/routes/_auth-pages`

```
_auth-pages/
├── login.tsx                 # 改造：社交按钮 + 邮箱密码 + 次要入口（魔法链接/OTP/匿名）
├── forgot-password.tsx       # 新增：输入邮箱 → 发重置链接 → 统一提示
├── reset-password.tsx        # 新增：带 token → 设置新密码
├── magic-link.tsx            # 新增：请求魔法链接（或并入 login 子状态）
└── verify-email.tsx          # 新增：处理验证回调 / 提示
```

组件拆分（单一职责，沿用 TanStack Form + zod + sonner）：

- `components/auth/social-buttons.tsx` — OAuth 按钮组，按 `VITE_*` 渲染
- 魔法链接表单、OTP 表单各自独立小组件
- Google One Tap：在认证页挂载组件，已登录或未配置则不渲染

登录页交互：社交按钮区在顶部；下方邮箱密码表单；表单旁「忘记密码？」链接；
次要入口「用邮箱链接登录」「用验证码登录」「以游客身份继续」。

### 7. 账户设置 `apps/web/src/routes/_app/settings`

```
_app/settings/
├── route.tsx          # 设置外壳：左侧二级导航 + <Outlet/>
├── index.tsx          # 重定向到 /settings/profile
├── profile.tsx        # 改昵称（头像延后，留 TODO 注释）
├── security.tsx       # 改密码 + 改邮箱（两张卡）
├── accounts.tsx       # 关联账户：列出已绑定 + 绑定/解绑 Google/GitHub/Apple
├── sessions.tsx       # 会话列表：当前设备高亮 + 单个登出 + 登出其它全部
└── danger.tsx         # 删除账户（二次确认弹窗）
```

各页对应 Better-Auth client 调用：

| 页面 | 调用 |
| --- | --- |
| profile | `authClient.updateUser({ name })` |
| security | `authClient.changePassword(...)` / `authClient.changeEmail(...)` |
| accounts | `authClient.listAccounts()` / `authClient.linkSocial(...)` / `authClient.unlinkAccount(...)` |
| sessions | `authClient.listSessions()` / `authClient.revokeSession(...)` / `authClient.revokeOtherSessions()` |
| danger | `authClient.deleteUser(...)`（带确认） |

二级导航数据由常量数组驱动；未启用的 provider 在 accounts 页自动隐藏对应绑定按钮。
匿名用户访问 settings 时，profile 页顶部显示「绑定正式账户以保存数据」引导，走正常
注册 / social link 流程触发 `onLinkAccount`。

## 环境变量

服务端（zod 校验，除既有两项外**均可选**）：

```
# 已有
BETTER_AUTH_SECRET, BETTER_AUTH_URL

# 邮件（缺失则回落 console 驱动）
RESEND_API_KEY?, EMAIL_FROM?

# OAuth（成对齐全才注册对应 provider）
GOOGLE_CLIENT_ID?, GOOGLE_CLIENT_SECRET?
GITHUB_CLIENT_ID?, GITHUB_CLIENT_SECRET?
APPLE_CLIENT_ID?, APPLE_CLIENT_SECRET?, APPLE_APP_BUNDLE_IDENTIFIER?
```

客户端（Vite，编译期）：

```
VITE_GOOGLE_CLIENT_ID?      # One Tap 需要 + 控制 Google 按钮显示
VITE_GITHUB_ENABLED?        # 控制 GitHub 按钮显示
VITE_APPLE_ENABLED?         # 控制 Apple 按钮显示
```

`apps/web/.env.example` 补齐全部项并加注释（作用、获取方式，含各 OAuth 控制台说明）。

## 错误处理

- **发信失败**：`mailer.send` 抛错时记录日志，不向客户端泄露内部细节。
- **防邮箱枚举**：密码重置 / 魔法链接一律返回「如果该邮箱存在，已发送」统一提示，
  无论邮箱是否注册。
- **OAuth 回调失败**：处理重定向带回的 error，toast 友好文案。
- **token 过期/无效**（重置 / 验证 / OTP）：明确文案 + 「重新发送」入口。
- **解绑最后一个登录方式**：accounts 页在解绑前校验「至少保留一个 credential 或
  social account」，否则禁用解绑按钮并提示，避免用户锁死自己。
- **删除账户**：二次确认（确认弹窗）；成功后清会话并跳回首页。

## 测试策略

沿用仓库现有测试方式；当前仓库未见测试框架，实现阶段确认，缺失则按生态标准用
Vitest 搭建。重点覆盖：

- `packages/email`：驱动选择逻辑（有 key→Resend，无 key→console）；console 驱动输出可断言。
- `packages/auth`：条件注册逻辑——给不同 env 组合，断言启用的 provider/插件集合正确
  （最易回归出错处）。
- 「禁止解绑最后一个登录方式」守卫逻辑单测。
- 设置页表单关键校验（zod schema）。
- （可选）端到端认证流：注册 → 用 console 驱动断言验证邮件已发出。

## 文档更新

- README：路线图 Phase 1 标 done；「What's in the box」表更新（Email 改为最小实现、
  Auth 行补充新方式）。
- CUSTOMIZE.md：更新第 9 节；新增「配置 OAuth / 邮件」小节。

## 验收标准

- 零额外配置下（仅 `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`）应用可启动；邮件类功能
  走 console 驱动，登录/注册/匿名/设置页均可用，未配置的社交按钮不显示。
- 配置任一 OAuth provider 后，对应按钮出现且可完成登录。
- 配置 `RESEND_API_KEY` 后，密码重置 / 验证 / 魔法链接 / OTP 邮件经 Resend 实际发出。
- 账户设置 6 个子页功能可用；匿名用户可升级为正式账户并保留身份。
- `pnpm check-types` 通过；新增测试通过。
