# 移动端应用设计（apps/mobile）

- 日期：2026-08-01
- 状态：设计已确认，待生成实现计划
- 影响范围：新增 `apps/mobile`；改动 `packages/auth/src/server.ts`、`packages/auth/src/client/native.ts`（新增）、root `package.json`、`biome.jsonc`；同步改动 `docs/superpowers/specs/2026-08-01-browser-extension-app-design.md` 的 3.2 节

## 1. 背景与目标

`apps/mobile` 目前是空占位目录（与 `apps/cli`、`apps/extension` 同）。仓库刚完成 `packages/ui/ui-web`、`packages/billing/billing-web`、`packages/analytics/analytics-web` 的嵌套子包重构（commit `f95e0b1`），`-web` 后缀预留的正是 react-native 这类真平台差异的接缝。`packages/auth/src/server.ts` 已注册 `expo()` 插件，`trustedOrigins` 已含自定义 scheme，服务端具备一半的移动端准备度；缺的是整个原生客户端层。

目标：用 Expo Managed React Native 建起 openstarter 的移动端，定位为**通用移动端模板**——打通鉴权、类型化 API 调用、导航、主题、国际化这五条管道，业务内容只保留最小但真实可用的页面，供使用者 fork 后替换。

成功标准：

1. iOS 与 Android 的 development build 中，未登录时停在登录页，完成邮箱密码或 Google 登录后进入 Tab 主界面；杀进程重开仍处于登录态。
2. 移动端调用 `packages/api` 的受保护端点是类型化的（复用 `AppType`），无手写 URL 与手写响应类型。
3. 登录页展示的登录方式由 `GET /api/config/public` 驱动，与服务端的条件注册保持一致，不出现"按钮存在但端点 404"。
4. `pnpm dev:mobile` 可用；`pnpm build`、`pnpm check-types`、`pnpm test`、`pnpm lint` 在新增端后全部通过。
5. EAS 的 development 与 preview profile 可产出构建；不含商店提审。

## 2. 已确认的需求决策

| 决策项 | 选定 | 放弃的选项与原因 |
| --- | --- | --- |
| 产品形态 | Expo Managed React Native，iOS + Android | Bare RN 要自己养原生工程，模板的维护成本转嫁给使用者；Capacitor/WebView 复用 Web UI，结果是 `apps/desktop` 的翻版——不是移动端应用，只是开在手机上的窗口 |
| 定位 | 通用移动端模板 | 做成当前 SaaS 的正式客户端会把 starter 绑死在具体业务；完整复刻 Web 功能则首版无法收敛 |
| 首版范围 | 基础模板：鉴权、首页、Tab 导航、个人资料、设置、主题、i18n、类型化 API 客户端 | 完整 SaaS 模板（组织、订阅、API Key、上传、工单）范围过大；最小演示（仅鉴权+首页）不足以证明管道打通 |
| 登录方式 | 邮箱密码 + Google/Apple OAuth + 安全会话持久化 | 仅邮箱密码无法验证深链回跳这条最易出错的路径；与 Web 完全对齐（passkey、2FA、匿名、Magic Link、Email OTP）会让首版验证面翻倍，这些保留插件位 |
| 后端边界 | 复用 Web 部署的 Hono `/api`，`EXPO_PUBLIC_API_URL` 区分环境 | 独立部署 `packages/api` 是运维决策，不该由新增一个端触发；Mobile BFF 在只有一个原生消费者时纯属多一跳；Mock API 会让"管道打通"变成假象 |
| 交付标准 | 本地模拟器/真机可运行 + EAS development/preview 构建 | 仅 Expo Go 无法验证 OAuth 深链（见 8.4）；商店提审依赖账号、签名与审核周期，不属于设计范围 |
| 架构 | 应用自包含，仅共享 `AppType` 类型 / 认证客户端 / i18n 消息 | 先建 `packages/ui/ui-native` 在只有一个消费者时是过早抽象；Tamagui/gluestack 跨端设计系统要返工现有 shadcn + Base UI + Tailwind v4 的 `ui-web` |
| 样式 | NativeWind 4.1 稳定版（内部锁 Tailwind v3） | NativeWind v5 对接 Tailwind v4 但仍是 preview，模板不该背 preview 依赖；`StyleSheet` + TS token 零工具链风险，但与仓库的 Tailwind DX 不一致 |
| 命名 | 全量改名为 openstarter | 保留 `turbostarter` 前缀等于把模板遗留命名永久固化 |

技术基线：Expo SDK 57 / React Native 0.86 / React 19.2，与仓库 catalog 的 `react: ^19.2.6` 一致。

选"基础模板"的已知代价：首版不会用到推送、相机、后台任务这类原生独有能力，设计重心因此完全落在管道上。

## 3. 架构

### 3.1 目录结构

```
apps/mobile/
  package.json
  app.config.ts              # scheme、bundle id / applicationId、插件配置
  eas.json                   # development / preview profile
  metro.config.js            # monorepo 解析 + withNativeWind
  tailwind.config.js         # token 镜像自 ui-web
  babel.config.js
  tsconfig.json
  .env.example
  .gitignore
  src/
    app/                     # Expo Router 文件式路由
      _layout.tsx            # Provider 装配 + 会话门禁
      (auth)/
        _layout.tsx
        sign-in.tsx
        sign-up.tsx
        forgot-password.tsx
      (tabs)/
        _layout.tsx          # 三个 Tab
        index.tsx            # 首页
        profile.tsx          # 个人资料
        settings.tsx         # 设置
    components/ui/           # button / input / card / badge / spinner / screen
    lib/
      env.ts                 # EXPO_PUBLIC_API_URL 校验
      auth-client.ts         # createAuthClient + expoClient
      api.ts                 # hc<AppType>
      auth-gate.ts           # deriveAuthGate 纯函数
      public-config.ts       # resolveEnabledProviders 纯函数
      api-error.ts           # mapApiError 纯函数
      i18n.ts                # resolveInitialLocale + setLocale 封装
      theme.ts               # 主题持久化
    paraglide/               # 生成物，git-ignored
```

`src/app` 而非根 `app`：[Expo 文档说明两者都开箱支持](https://docs.expo.dev/router/reference/src-directory)，且 SDK 55 之后的默认模板就是 `src/app`，无需额外配置。

### 3.2 依赖边界与三条共享通道

移动端与 Web 不共享任何运行时代码，只共享契约。

**API 契约。** `import type { AppType } from "@openstarter/api"`，再 `hc<AppType>(baseUrl)`，与 `apps/web` 的 `hc<AppType>("/")` 完全对称。`import type` 在编译期被擦除，Metro 看不到服务端依赖图。为让这个意图在依赖清单里可见，`@openstarter/api` 声明为 `devDependencies` 而非 `dependencies`——它只在构建期提供类型。

**认证客户端。** 新增 `packages/auth/src/client/native.ts`，沿用现有 `client/web.ts` 的平台分文件约定。导出集合 = `client/web.ts` 的集合减去 `passkeyClient`（依赖浏览器 WebAuthn）与 `oneTapClient`（Web 专属，且需构造期传入 clientId），即 `createAuthClient` 加 `inferAdditionalFields`、`magicLinkClient`、`emailOTPClient`、`twoFactorClient`、`anonymousClient`、`adminClient`、`organizationClient`、`lastLoginMethodClient`。**导出不等于启用**：这些是可用的插件位，首版 `auth-client.ts` 只注册 `expoClient` 一个——邮箱密码与 OAuth 属 better-auth 核心能力，不需要插件。这一点与 `apps/web` 的 `auth-client.ts` 有意不同：Web 注册了除 `oneTapClient` 外的全集，原生端则按首版实际启用的登录方式收窄，不为未经验证的路径预先引入插件。`expoClient` 由 `apps/mobile` 自己从 `@better-auth/expo/client` 组合，因为它的 peer 依赖属于移动应用，不该装进服务端也依赖的 `packages/auth`。

**i18n 消息。** `paraglide-js compile` 指向 `packages/i18n/project.inlang`，产物落 `src/paraglide`（git-ignored，与 `apps/web/src/paraglide` 同样是生成物），消息源与 Web 是同一份 `packages/i18n/messages/{locale}.json`。

禁止的依赖：`@openstarter/db`、`@openstarter/auth` 根入口与 `/server`、`@openstarter/ui-web`、`@openstarter/shared` 根入口（它依赖 `@openstarter/db`）。若确有纯常量需要共享，走 `@openstarter/shared/<子路径>` 精确导入，并逐个确认无 db 传递依赖。

依赖分类（均 `workspace:*`）：

| 包 | 位置 | 理由 |
| --- | --- | --- |
| `@openstarter/auth` | dependencies | `client/native` 是运行时导入 |
| `@openstarter/i18n` | dependencies | 根入口导出 `SUPPORTED_LOCALES` / `DEFAULT_LOCALE` 运行时常量；该包零运行时依赖，已核实 |
| `@openstarter/api` | devDependencies | 仅 `import type { AppType }` |

`react`、`react-dom`、`@types/react` 走 `catalog:`；`@inlang/paraglide-js` 同样走 `catalog:`（`apps/web` 已是如此，两端必须用同一版本编译同一份消息目录）。`expo`、`react-native`、`nativewind`、`tailwindcss` 及各 `expo-*` 模块钉版本、不进 catalog——catalog 是多包共用的版本表，单包依赖塞进去只会让该表更难读（沿用插件端 spec 的同一判断）。

### 3.3 刻意不新建的东西

- **不建 `packages/ui/ui-native`。** 只有一个消费者时属过早抽象。首版组件放 `apps/mobile/src/components/ui`，等第二个原生端出现再抽包——这是明确的演进点，不是遗漏。
- **不建 `packages/api/api-client` 之类的客户端封装包。** `apps/web` 直接 `hc<AppType>("/")`，移动端直接 `hc<AppType>(base)`，两侧对称且各自只有一行，抽包不减少任何重复。
- **不建 Mobile BFF、不独立部署 API。**
- **不启用 Expo Web 目标。** 一旦启用，CORS 就从"不需要"变成"必须"（见 5.3），且 `ui-web` 与 `ui-native` 的职责会开始纠缠。

### 3.4 与插件端 spec 的差异说明

插件端 spec 的 3.4 节明确"不建 `packages/auth/src/client/extension.ts`"，理由是插件端的平台差异全在 chrome-only 代码，纯转发文件本身无价值。本设计新建 `client/native.ts` 与之不矛盾：原生端要表达的是**哪些 better-auth client 插件在 RN 下安全**——排除 `passkeyClient` 与 `oneTapClient`。这是平台知识，不是转发，且与 `client/web.ts` 并列可读。native 特有的 chrome 式代码（`expoClient` 及其 expo peer 依赖）同样留在应用内，与插件端的判断一致。

## 4. 认证与会话

`src/lib/auth-client.ts` 用 `@openstarter/auth/client/native` 的 `createAuthClient` 构造客户端，plugins 数组首版只含一项——本地构造的 `expoClient`（其余插件位见 3.2）：

```ts
expoClient({
  scheme: "openstarter",
  storage: SecureStore,
  cookiePrefix: "openstarter",
})
```

**存储。** `expo-secure-store` 的 `getItem` / `setItem` 是同步 API 且 `getItem` 返回 `string | null`，正好匹配 `ExpoClientOptions.storage` 的契约（已核实 `@better-auth/expo@1.6.11` 的 `dist/client.d.ts`）。会话因此落在 iOS 钥匙串 / Android KeyStore，而非普通存储。

**`cookiePrefix` 必须显式对齐服务端。** Expo 插件默认按 `better-auth` 前缀识别 cookie，与服务端 `advanced.cookiePrefix` 不一致会导致它认不出会话 cookie，表现为反复重新拉取会话或登录后立刻掉线。改名后两侧统一为 `openstarter`。

**非 auth 请求如何携带会话。** `expoClient` 暴露 `getCookie(): string`，其 JSDoc 明确说明用途是取出设备上存储的 cookie 并附加到自己的 fetch 请求（已核实同一份 `client.d.ts`）。API 客户端据此接线，见 5.2。

**会话保鲜。** 接上 `setupExpoFocusManager` 与 `setupExpoOnlineManager`，使应用回到前台或网络恢复时自动重新校验会话。两者由 Expo 插件提供，peer 依赖 `expo-network` 本就在安装清单内，接入成本接近零。

**OAuth 流程。** `signIn.social({ provider, callbackURL })` → Expo 插件用 `expo-web-browser` 打开授权页 → 完成后经 `openstarter://` scheme 深链回到应用 → 会话 cookie 写入 SecureStore。Apple 登录要求 iOS bundle identifier 与服务端 `APPLE_APP_BUNDLE_IDENTIFIER` 一致，服务端已支持该配置项。

**会话门禁。** `src/app/_layout.tsx` 用 `authClient.useSession()` 的结果决定停在 `(auth)` 还是 `(tabs)`。判断逻辑抽成纯函数 `deriveAuthGate(session, isLoading)`，关键是加载态不得被误判为未登录——否则已登录用户会看到一帧登录页。启动时先同步读一次 SecureStore 缓存再渲染。

**扩展位。** 首版只注册 `expoClient`，不接 passkey、2FA、匿名登录、Magic Link、Email OTP。`client/native.ts` 已导出对应插件工厂（见 3.2），后续启用只需在 `auth-client.ts` 的 plugins 数组里加一项，不改结构。

## 5. 数据流、环境与网络边界

### 5.1 环境变量

`src/lib/env.ts` 用 zod 校验 `EXPO_PUBLIC_API_URL`（Expo 只把 `EXPO_PUBLIC_` 前缀的变量注入客户端），要求绝对 URL。缺失或非法时给出明确的配置错误提示，而不是退化成网络错误——理由与插件端 spec 把 `misconfigured` 单列一态相同：fork 该 starter 的人否则无从判断。

`.env.example`：

```
# Web 应用（同时也是 API）的源。真机调试须填局域网 IP，
# localhost 在设备上指向设备自身，不是你的开发机。
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

### 5.2 API 客户端

```ts
export const client = hc<AppType>(env.apiUrl, {
  headers: () => ({ cookie: authClient.getCookie() }),
});
```

与插件端 spec 的 `hc<AppType>(base, { headers: async () => ... })` 是同一形状，仅凭证来源不同：那边是 `chrome.cookies` + Bearer，这边是 SecureStore + cookie。

### 5.3 CORS 不需要处理

`packages/api` 当前没有任何 CORS 中间件（已核实）。这在插件端 spec 里被列为待验证风险，但对原生端不构成问题：React Native 的 `fetch` 不实施浏览器的同源策略，跨源请求不触发预检。前提是不启用 Expo Web 目标——已列入非目标。

### 5.4 数据层

TanStack Query v5，与 `apps/web` 同一主版本，`QueryClientProvider` 挂在根 layout。会话状态不进 Query，走 `authClient.useSession()` 自己的 store，避免两套缓存互相打架。

## 6. 界面、导航与主题

**导航**用 Expo Router 的路由组表达登录态，结构见 3.1。

**登录页的登录方式由服务端配置驱动，不硬编码。** `packages/auth/src/server.ts` 里 Google / GitHub / Apple 是条件注册的——开关关闭时对应端点不存在。`GET /api/config/public` 正是为此设计（该文件注释写明是给登录页决定展示哪些 OAuth 入口用的），下发 `email_auth_enabled`、`google_auth_enabled`、`github_auth_enabled`、`apple_auth_enabled`、`password_reset_enabled` 等白名单开关，`apps/web` 已在这么做。硬编码的后果是用户点按钮拿到 404。忘记密码入口同样只在 `password_reset_enabled` 为真时可达——该标志还额外依赖邮件渠道是否配置完成。派生逻辑抽成纯函数 `resolveEnabledProviders(publicConfig)`。

**首页**作为类型化调用的样板，展示当前用户与 `GET /api/user/plan` 的真实结果。选它是因为它 `requireAuth`、返回结构简单，恰好同时证明"会话带上去了"与"类型推导通了"两件事。

**个人资料**页展示用户信息并支持改名（`authClient.updateUser`）。

**设置**页放主题切换（浅色 / 深色 / 跟随系统）、语言切换（en / zh）、版本号与登出。登出只出现在这一处。

**组件**保持最小集：`button`、`input`、`card`、`badge`、`spinner`，加一个处理安全区的屏幕容器。不复刻 `ui-web` 的全部组件，上述页面用不到的不建。

**主题**用 NativeWind 的 `dark:` 变体，语义 token（`background`、`foreground`、`primary`、`muted`、`destructive`、`border`）从 `ui-web` 的 `globals.css` 镜像进 `tailwind.config.js`，主题选择持久化。不复用 `next-themes`，它是 Web 专属的。

**表单**用 `@tanstack/react-form`（headless，与 Web 同一套）配 zod。校验 schema 在应用内定义，**不从 `@openstarter/api` 导入**——那是运行时导入，会把服务端依赖图拉进 Metro，正好打穿 3.2 的边界。代价是登录表单几条规则有少量重复。

**国际化。** Web 使用的 `url` / `cookie` 策略是浏览器专属，原生端改为 `globalVariable` + `baseLocale`：启动时用 `expo-localization` 读设备语言，与持久化的用户选择合并后显式 `setLocale`。落地细节：Paraglide 的 `setLocale` 在 Web 上默认触发页面重载，原生端没有重载概念，需 `reload: false` 并用 React state 驱动重渲染。解析优先级抽成纯函数 `resolveInitialLocale(deviceLocales, persisted)`。

**无障碍**按 RN 方式落地：图标按钮必须有 `accessibilityLabel`，交互元素声明 `accessibilityRole`，点击区不小于 44×44。仓库的 Ultracite a11y 规则面向 DOM/JSX，原生端靠约定而非 linter 兜住。

## 7. 错误处理约定

1. 后端错误体统一为 `{ code: -1, message }`（`packages/api` 的 `app.onError`）。非 2xx 时读 JSON 取 `message`，取不到则用状态码兜底文案。
2. **401 归入"未登录"，不归错误。** 跳回 `(auth)` 并清理本地会话，不弹错误提示。token 过期、会话被吊销、服务端不认，对用户而言都是"没登录"。此约定与插件端 spec 第 7 节一致——两个客户端保持同一语义，使用者读一份就懂两端。
3. fetch 本身 reject（后端未启动、IP 填错）→ 错误态，文案体现"服务不可达"，附重试。
4. 配置缺失或非法（`EXPO_PUBLIC_API_URL`）→ 独立的配置错误态，不与网络错误混同。

映射逻辑抽成纯函数 `mapApiError(response)`。

## 8. monorepo 接线

### 8.1 既有文件改动

| 文件 | 改动 |
| --- | --- |
| root `package.json` | 加 `"dev:mobile": "turbo -F mobile dev"`，对齐 `dev:web` / `dev:desktop` |
| `biome.jsonc` | `files.includes` 加 `"!!apps/mobile/src/paraglide"`、`"!!apps/mobile/.expo"`，沿用现有逐项列举写法 |
| `packages/auth/src/server.ts` | 全量改名：`advanced.cookiePrefix` → `"openstarter"`、`appName` → `"OpenStarter"`、`trustedOrigins` 的 `"turbostarter://"` → `"openstarter://"` |
| `packages/auth/src/client/native.ts` | 新增，见 3.2 |
| 插件端 spec 3.2 节 | cookie 名同步改为 `openstarter.session_token` / `__Secure-openstarter.session_token` |

`turbo.json` 与 `pnpm-workspace.yaml` 不改：`apps/*` 已覆盖，`dev` 任务已是 `cache: false` + `persistent`，适配 `expo start`。`apps/mobile` 不定义 `build` 脚本（Expo 构建在 EAS 远端，本地无产物目录），Turbo 自然跳过，`pnpm build` 不受影响。

改名的连带影响写在实施步骤说明里：`cookiePrefix` 变更会让所有现存会话一次性失效，Web 端当前登录的人会被登出一次。`appName` 出现在验证码邮件与 passkey 的 relying party 显示名中；passkey 的 RP ID 由域名派生，改显示名不会作废已注册凭据。`packages/auth/src/rbac/index.ts` 第 5 行的 `TurboStarter` 仅是注释中的出处说明，不在改名范围内。

### 8.2 apps/mobile 自身配置

脚本：

- `dev`：`paraglide-js compile && expo start`
- `check-types`：`paraglide-js compile && tsc --noEmit`
- `test` / `test:coverage`：`vitest --run` / `vitest --run --coverage`
- `paraglide:compile`：单独暴露，供上述两处复用

`paraglide-js compile` 必须前置于 `dev` 与 `check-types`，否则 `src/paraglide` 不存在会导致解析失败；这与 root `check-types` 先跑 `generate:routes` 是同一模式。

`tsconfig.json` 自包含、不 extends `tsconfig.base.json`——`apps/web` 与 `apps/desktop` 现状皆如此，且避免与 Expo 生成的类型在 `types` / `paths` 上打架。含 `jsx: react-jsx`、`moduleResolution: bundler`、`paths` 的 `@/*` → `./src/*`、`allowJs: true`（Paraglide 输出 JSDoc 标注的 `.js`，`apps/web` 已是同样处理）、`verbatimModuleSyntax: true`（Ultracite 要求 `import type` / `export type`，该项在编译期强制之，同时保证 3.2 的类型擦除边界不被误写破坏）。

`metro.config.js` 处理三件事：`watchFolders` 指向仓库根、`nodeModulesPaths` 含根 `node_modules`、启用 package exports（`@openstarter/*` 的 exports map 依赖它）。外层包 NativeWind 的 `withNativeWind`。

`app.config.ts`：scheme `openstarter`；iOS `bundleIdentifier` 与 Android `applicationId` 取同一个反向域名值 `dev.openstarter.app`，两端一致以免深链与 OAuth 回调配置分叉。该值同时必须与服务端 `APPLE_APP_BUNDLE_IDENTIFIER` 环境变量一致，否则 Apple 登录不通——这是 Apple 登录唯一的跨端硬约束，写在 `app.config.ts` 的注释里。插件列表含 `expo-router`、`expo-secure-store`。

`eas.json`：development 与 preview 两个 profile。development 用于日常真机调试与 OAuth 深链验证，preview 用于分发给他人试用。

`.gitignore` 按 `apps/desktop` 的先例放 per-app：`node_modules`、`.expo`、`src/paraglide`、`ios/`、`android/`（Managed 下不提交原生目录）、`.env*`（保留 `!.env.example`）、`.turbo`。不动 root `.gitignore`。

新增文件须通过 Ultracite：`pnpm lint` 走 `scripts/check-quality.mjs`，以 `.ultracite-baseline.json` 为基线对变更文件设卡，新代码不享受历史豁免。

### 8.3 测试策略

沿用仓库既有的 Vitest，做法与插件端 spec 一致：把判断逻辑抽成纯函数，副作用注入。覆盖：

- `deriveAuthGate(session, isLoading)` —— 已登录 → `(tabs)`；未登录 → `(auth)`；**加载态不得判为未登录**
- `resolveEnabledProviders(publicConfig)` —— 开关为 `"false"` 或缺失时不渲染对应按钮；`password_reset_enabled` 为假时忘记密码入口不可达
- `mapApiError(response)` —— 401 → 未登录；500 带 `{code:-1,message}` → 错误且取到 message；500 空 body → 用状态码文案；fetch reject → 服务不可达；配置非法 → 配置错误态
- `resolveInitialLocale(deviceLocales, persisted)` —— 持久化优先、设备语言次之、都不命中回落 `DEFAULT_LOCALE`；不支持的语言不得原样透传

明确不做：RN 组件渲染测试。Vitest 接 React Native preset 的成本高于它在此范围内的收益，v1 只测纯函数，界面走 8.4 的手工清单。真实 SecureStore 读写、真实 OAuth 深链同样不做自动化。

服务端回归：改名后跑 root `pnpm test`，确认 `packages/api` 与 `packages/auth` 既有测试中没有对 `turbostarter` 字面量的断言。

### 8.4 手工验证清单

自动化无法覆盖但必须执行：

1. `pnpm dev:web` 起后端，`apps/mobile/.env` 填 `EXPO_PUBLIC_API_URL=http://<局域网IP>:3000`。
2. 用 **development build** 打开，不用 Expo Go —— Expo Go 的 scheme 不是应用自己的，OAuth 回跳会落不回来。
3. 邮箱密码注册并登录 → 杀进程重开，仍处于登录态（验证 SecureStore 持久化）。
4. Google 登录 → 浏览器授权 → 深链回跳 → 已登录。
5. 在 admin 关掉 `google_auth_enabled` → 重开登录页 → Google 按钮消失。
6. 首页显示 `/api/user/plan` 的真实数据。
7. 把 `EXPO_PUBLIC_API_URL` 改错 → 明确的配置错误文案，不是白屏、也不是笼统的网络错误。
8. 服务端吊销会话 → 应用内请求 401 → 跳回登录页，不弹错误提示。
9. 切换语言与主题后杀进程重开 → 选择保留。
10. Apple 登录（需真机与 Apple 开发者账号，模拟器不可用）。

## 9. 已知风险与兜底

**Tailwind 双主版本并存。** mobile 用 v3（NativeWind 4.1 的约束），`ui-web` 用 v4。pnpm 按包隔离依赖，风险不在安装而在 token 人工同步。兜底：token 集中在 `tailwind.config.js` 单处并注释标明来源文件，偏移时一处可查。演进路径是 NativeWind v5 转正后升级并共享 `@theme`。

**Metro 解析 workspace 内 TS 源码 + package exports。** 这是本方案最可能卡住的一环：`@openstarter/*` 均不经构建、直接暴露 `./src/*.ts`。兜底：若 `@openstarter/auth/client/native` 解析不通，把该文件内容内联到 `apps/mobile/src/lib`，放弃跨包共享但保留能力，不阻塞交付。

**Paraglide 在 RN 下的策略配置。** `globalVariable` + `baseLocale` 按文档成立但未在本仓库实测。兜底：若编译产物的存储策略不适配 RN，只用 `globalVariable`，语言持久化完全由应用自己管。

**全量改名导致现存会话失效。** 一次性登出，见 8.1 的说明要求。

**Apple 登录依赖真机与 Apple 开发者账号。** 手工验证以 Google 为主，Apple 项标注需真机。

**EAS 构建需要 Expo 账号。** 无账号时用本地 `expo run:ios` / `expo run:android` 出 development build 作为兜底，前提是已装 Xcode / Android Studio。

## 10. 明确的非目标

- 不做推送通知、内购与订阅、离线缓存、后台任务、相机与文件上传。
- 不做组织与 API Key 管理、工单、AI 任务等 Web 端已覆盖的业务域。
- 不启用 Expo Web 目标。
- 不做商店提审与上架。
- 不接 passkey、2FA、匿名登录、Magic Link、Email OTP（保留插件位）。
- 不改动 `apps/web`、`apps/desktop`、`apps/extension` 的任何代码。
- 不新建 `packages/ui/ui-native` 或独立的 API 客户端包。
- 不改动 `packages/api`（含不加 CORS 中间件，理由见 5.3）。

## 参考来源

- [Expo SDK 57 发布说明](https://expo.dev/changelog/sdk-57)
- [Expo Router：顶层 src 目录](https://docs.expo.dev/router/reference/src-directory)
- [NativeWind 迁移指南（v4.1 稳定、v5 预览）](https://nativewind.dev/guides/migration)
- [NativeWind v5 与 Tailwind v4](https://nativewind.dev/v5/core-concepts/tailwindcss)
- 本仓库已核实来源：`@better-auth/expo@1.6.11` 的 `dist/client.d.ts`（`ExpoClientOptions.storage` 契约、`getCookie()` 用途、`setupExpoFocusManager` / `setupExpoOnlineManager`）、`packages/auth/src/server.ts`、`packages/api/src/routes/config.ts`、`packages/api/src/routes/user.ts`、`apps/web/src/lib/{api,auth-client,i18n}.ts`
- 兄弟设计文档：`docs/superpowers/specs/2026-08-01-browser-extension-app-design.md`

外部来源内容均经转述与概括，以符合许可要求。
