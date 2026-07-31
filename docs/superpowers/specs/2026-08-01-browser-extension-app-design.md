# 浏览器插件端应用设计（apps/extension）

- 日期：2026-08-01
- 状态：设计已确认，待生成实现计划
- 影响范围：新增 `apps/extension`；改动 `packages/auth/src/server.ts`、`turbo.json`、`biome.jsonc`、root `package.json`；条件性改动 `packages/api`（仅当 CORS 兜底被触发，见 9）

## 1. 背景与目标

`apps/extension` 目前是空占位目录（与 `apps/mobile`、`apps/cli` 同）。仓库刚完成 `packages/ui/ui-web`、`packages/billing/billing-web`、`packages/analytics/analytics-web` 的嵌套子包重构（commit `f95e0b1`），该 `-web` 后缀正是为多端预留的分端接缝。`packages/auth/src/server.ts` 的 `trustedOrigins` 已含 `"chrome-extension://"`。

目标：把 openstarter 的第五个端从零建起，定位为**脚手架为主 + 一个样板功能**。即打通登录态、类型化 API 调用、共享 UI 复用、构建产物这四条管道，业务内容只保留一个最小但真实可用的面板，供使用者 fork 后替换。

成功标准：

1. 在 Chromium 系浏览器加载 unpacked 产物后，未登录时 popup 显示引导登录，用户在 web 端登录后重开 popup 即显示真实账户数据。
2. 插件端调用 `packages/api` 的受保护端点是类型化的（复用 `AppType`），无手写 URL 与手写响应类型。
3. 插件端复用 `@openstarter/ui-web` 组件，不产生第二套 UI 实现。
4. `pnpm dev:extension`、`pnpm build`、`pnpm check-types`、`pnpm test`、`pnpm lint` 在新增端后全部通过。

## 2. 已确认的需求决策

| 决策项 | 选定 | 放弃的选项与原因 |
| --- | --- | --- |
| 定位 | 脚手架为主 + 一个样板功能 | 纯脚手架会变成"能编译但没人知道怎么用"的空壳；纯业务插件会把 starter 绑死在某个场景 |
| 样板功能 | 只读账户面板 | 划词 AI（`ai-tasks`）、截图提工单（`tickets`）示范面更宽但范围更大；网页剪藏受 `post.create` 的 RBAC 限制，只有管理员能跑通 |
| 登录体验 | 复用 web 端会话，插件内无登录表单 | 插件内自建登录需在 MV3 里用 `chrome.identity.launchWebAuthFlow` 绕 OAuth，且 passkey / 2FA 无法复用，等于造一个能力更差的副本；API Key 粘贴是开发者工具级体验 |
| 浏览器范围 | 仅 Chromium 系（Chrome / Edge / Brave） | Firefox 不支持 `externally_connectable`（Bugzilla #1319168 仍开放）且 `browser.*` 命名空间有差异，需要双 manifest 与双端验证；Safari 需 Xcode 转换与 Apple 账号，属另一量级 |
| 会话桥接机制 | `chrome.cookies` 直读 + Bearer 转发 | 见 3.2 |
| 构建工具 | WXT | Plasmo 基于 Parcel，接不上仓库既有的 Vite 插件生态（`@tailwindcss/vite`、Paraglide） |

样板功能选只读面板的已知代价：插件不会用到 content script、选区、截图这类浏览器独有能力，MV3 的多上下文通信也不会被示范。设计重心因此完全落在管道上。

## 3. 架构

### 3.1 目录结构

```
apps/extension/
  package.json
  wxt.config.ts            # manifest 与 vite 插件配置
  tsconfig.json            # extends ./.wxt/tsconfig.json
  .env.example
  .gitignore
  src/
    entrypoints/popup/
      index.html
      main.tsx             # React 挂载
    lib/
      env.ts               # 读取并校验 VITE_APP_URL
      session.ts           # cookie 名解析 + chrome.cookies 读 token
      auth-client.ts       # createAuthClient({ baseURL, fetchOptions.auth })
      api.ts               # hc<AppType>(base, { headers: async () => ... })
      state.ts             # deriveState 纯函数与 PanelState 类型
    components/
      account-panel.tsx    # ready 态
      signed-out.tsx       # signed-out 态
      error-state.tsx      # error 与 misconfigured 态
    styles/globals.css
```

### 3.2 会话桥接机制

选定方案：popup 用 `chrome.cookies` 读取 web 应用域下的 Better Auth 会话 cookie，将其值作为 `Authorization: Bearer <value>` 附加到所有 API 请求。

机制依据（读 `better-auth@1.6.11` 的 `dist/plugins/bearer/index.mjs` 得到）：

- `bearer` plugin 的 before 钩子仅在请求携带 `authorization` 头时触发；命中 `bearer ` scheme 后取出 token。
- token 含 `.` 时按"已签名"处理，对 `token.signature` 做 SHA-256 HMAC 校验，通过后**将其注入为请求的 session cookie** 再交给下游。
- after 钩子把 `Set-Cookie` 中的会话值原样输出为 `set-auth-token` 响应头 —— 这反证了会话 cookie 的值本身就是 `token.signature` 格式，正是 dot 分支期待的输入。

因此把 cookie 值当 Bearer token 送出是机制上成立的，不依赖任何猜测。

`packages/api/src/middleware/auth.ts` 走的是 `createAuth().api.getSession({ headers })`，所以服务端只要注册 `bearer()`，**现有全部域路由的 `requireAuth` 自动支持 Bearer，中间件与路由零改动**。

`advanced.cookiePrefix` 配置为 `"turbostarter"`，故 cookie 名为 `turbostarter.session_token`；HTTPS 下浏览器会使用 `__Secure-turbostarter.session_token` 变体。解析顺序：先试带 `__Secure-` 前缀者，未命中再试无前缀者，两者皆无则判定未登录。

不缓存 token：每次 popup 打开时从 cookie jar 现读，仅在 popup 生命周期内驻留内存。因此 manifest 不需要 `storage` 权限，也不存在"插件本地持久化了会话凭证"这一风险面。

### 3.3 被否决的备选桥接方案

- **`externally_connectable` + web 端授权页**：Better Auth 的 session cookie 是 httpOnly，web 端 JS 读不到，必须额外新增一个后端端点专门换发 token 给插件。改动面从"加一个 plugin"膨胀到"加 plugin + 加 web 路由 + 加后端端点 + 双向配置 extension ID"，用户还要多点一次授权，换来的仅是省掉 `cookies` 权限。
- **popup 内 iframe 嵌 web 端页面**：零后端改动，但这就是 `apps/desktop` 的做法 —— 不是插件端应用，只是开在工具栏上的窗口。不复用任何 `@openstarter/*` 包、无类型化 API、无共享 UI，作为 starter 的第五个端示范价值接近零；且 web 端需放开 CSP `frame-ancestors`。

### 3.4 刻意不新建的东西

- **不建 `packages/ui/ui-extension`。** popup 跑的是同一个 DOM，`@openstarter/ui-web` 直接可用：已核实它对 `@tanstack/*` 零依赖，且已有 `card`、`badge`、`button`、`skeleton` 这几个面板所需组件。`-web` 后缀预留的是 react-native 那类真平台差异，浏览器插件不属于此类。
- **不建 `packages/auth/src/client/extension.ts`。** web 版仅是再导出，插件端的差异全在"如何获取 token"，而那是 chrome-only 代码；放进 `packages/auth` 会让服务端也依赖的包沾上 chrome 类型。插件直接 import `@openstarter/auth/client/web`。另外 Ultracite 禁止"导出什么都不改变的空模块"，纯转发文件本身即违规。
- **不建 background service worker。** `chrome.cookies` 在 popup 这类扩展页面中同样可用，只读面板按需打开，无常驻需求。WXT 的 `entrypoints/background.ts` 是随时可加的接缝。

### 3.5 共享包依赖

`@openstarter/api`（仅取 `type AppType`）、`@openstarter/auth`（`client/web` 的 plugin factories）、`@openstarter/ui-web`，均 `workspace:*`。`react`、`react-dom`、`@types/react`、`hono`、`better-auth` 走 `catalog:`。`wxt` 与 `@wxt-dev/module-react` 直接钉版本、不进 catalog —— catalog 是多包共用的版本表，单包依赖塞进去只会让该表更难读。

## 4. 服务端改动

唯一无条件改动：`packages/auth/src/server.ts` 的 plugins 数组加入 `bearer({ requireSignature: true })`。同文件的 `trustedOrigins` 存在一处条件性收窄，仅在 CORS 兜底被触发时执行（见 9）。

`requireSignature` 必须显式设为 `true`。默认值 `false` 下，一个**不带签名的裸 session token** 也会被接受（plugin 自行补签后再校验，等于形式化通过）。本设计送入的 cookie 值本就带签名、走 dot 分支做真实 HMAC 校验，因此打开该开关对正常路径零影响，同时堵掉"仅凭裸 token 即可认证"这条路。

影响面：before 钩子仅在请求带 `authorization` 头时触发，web 端现有的 cookie 认证路径完全不受影响。净效果是在既有的"会话 / API Key"双通道之上叠加第三条 Bearer 通道，是叠加而非替换。此为安全相关改动，需以实测而非推理确认（见 8.3）。

## 5. 配置与权限

manifest 权限只申请一项：`cookies`。

- 不要 `storage`：不缓存 token（见 3.2）。
- 不要 `tabs`：`chrome.tabs.create` 不需要该权限，只有读取标签页 URL / 标题才需要。

`host_permissions` 由 `VITE_APP_URL` 在构建期派生为 `new URL(VITE_APP_URL).origin + "/*"`。`wxt.config.ts` 在 Node 中执行可直接读 `process.env`，运行时代码读 `import.meta.env.VITE_APP_URL`，同一变量喂两侧，不会漂移。

WXT 0.21.3 的 `envPrefix` 默认为 `["VITE_", "WXT_"]`，本设计沿用仓库既有的 `VITE_` 前缀（与 `VITE_GOOGLE_CLIENT_ID`、`VITE_GITHUB_ENABLED` 一致）。

`apps/extension/.env.example`（注释中文，与仓库既有 `.env.example` 风格一致）：

```
# web 应用（同时也是 API）的源。插件由此派生 host_permissions 与 API base URL
VITE_APP_URL=http://localhost:3000
```

## 6. popup 状态机与界面

```ts
type PanelState =
  | { kind: "loading" }
  | { kind: "misconfigured"; reason: string }
  | { kind: "signed-out" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: AccountSnapshot };
```

`misconfigured` 单列一态是有意的：`VITE_APP_URL` 未配置时若表现为"网络错误"，fork 该 starter 的人无从判断，这是给使用者的第一道提示。

`AccountSnapshot` 由三个端点并发拉取组成：

- `GET /api/user/plan` —— 方案状态（none / trial / expired / member）
- `GET /api/user/credits` —— 仅取积分余额
- `GET /api/user/subscription` —— 订阅状态与下一计费日

`/api/user/credits` 另返回流水历史、`/api/user/orders` 有分页订单，v1 均不取：popup 空间放不下，且那是 web 端 Settings 页的职责。

面板内容：顶部用户名 / 邮箱（来自 `authClient.useSession()`，走同一条 Bearer）、方案徽章（`badge.tsx`）、积分余额、订阅状态与下一计费日。底部两个动作：

1. 「在 web 端管理」—— `chrome.tabs.create` 打开 `/settings`。
2. 「退出登录」—— 调 `authClient.signOut()`。因共享同一会话，**web 端会一并登出**，这是该桥接方案的固有语义。按钮下方必须有一行小字明示此点，不得让用户在不知情的情况下被登出。

## 7. 错误处理约定

1. `packages/api` 的错误体统一为 `{ code: -1, message }`（`app.onError`）。非 2xx 时读 JSON 取 `message`，取不到则用状态码兜底文案。
2. **401 归入 `signed-out`，不归 `error`。** token 过期、会话被吊销、服务端不认，对用户而言都是"没登录"，应引导去登录而非弹报错。这是错误处理中最要紧的区分。
3. fetch 本身 reject（后端未启动、域名不通）→ `error` 态，文案需体现"服务不可达"，附重试。
4. 三个端点并发，**任一失败即整体降级为 `error`**，不做部分渲染。账户快照是一个整体，半张脸比空脸更误导 —— 积分显示了但方案栏空着，用户会以为方案真是空的。

## 8. monorepo 接线

### 8.1 既有文件改动

| 文件 | 改动 |
| --- | --- |
| root `package.json` | 加 `"dev:extension": "turbo -F extension dev"`，对齐 `dev:web` / `dev:desktop` |
| `turbo.json` | `build` 任务的 `outputs` 增加 `.output/**` |
| `biome.jsonc` | `files.includes` 增加 `"!!apps/extension/.output"`、`"!!apps/extension/.wxt"`，沿用既有 `"!!apps/web/.output"` 的逐项列举写法 |
| `packages/auth/src/server.ts` | plugins 加入 `bearer({ requireSignature: true })` |

`pnpm-workspace.yaml` 无需改动，`apps/*` 已覆盖。

`turbo.json` 那条顺带修掉一个既有缺口：`apps/web` 的构建产物同样落在 `.output/`（`start` 脚本跑的就是 `.output/server/index.mjs`），但当前 `outputs` 只声明了 `dist/**` 与 `src/routeTree.gen.ts`，意味着 web 的构建缓存命中时产物不会被恢复。加 `.output/**` 是插件端构建的必需项，同时补上这个洞 —— 同一处改动，非额外重构。

### 8.2 apps/extension 自身配置

脚本：

- `dev`：`wxt`
- `build`：`wxt build`
- `zip`：`wxt zip`（上架打包）
- `check-types`：`wxt prepare && tsc --noEmit`
- `test` / `test:coverage`：`vitest --run` / `vitest --run --coverage`
- `postinstall`：`wxt prepare`

`check-types` 必须串 `wxt prepare`，否则 `.wxt/tsconfig.json` 不存在会导致 tsc 失败；这与 root `check-types` 先跑 `generate:routes` 是同一模式。

`tsconfig.json` extends `./.wxt/tsconfig.json`，并显式声明 `verbatimModuleSyntax: true`（Ultracite 要求 `import type` / `export type`，该项在编译期强制之），以及镜像 `apps/web` 的 `paths` 别名 `@openstarter/ui-web/*`。不 extends root `tsconfig.base.json` —— 与 `apps/web`、`apps/desktop` 的现状保持一致，且避免与 WXT 生成的 tsconfig 在 `paths` / `types` 上打架。不引入 `noUncheckedIndexedAccess`，以免插件端成为唯一开启该项的 app 而产生不一致。

`.gitignore` 按 `apps/desktop` 的先例放 per-app：`.output`、`.wxt`、`.env*`（保留 `!.env.example`）、`.turbo`。不动 root `.gitignore`。

版本兼容性（已核实）：

- WXT `0.21.3` 的 peerDependencies 为 `vite: ^6.3.4 || ^7.0.0 || ^8.0.0-0`，仓库装的是 Vite `8.2.0`，兼容，无需降级。
- `@wxt-dev/module-react` `1.2.2` 的 peer 同样覆盖 Vite 8，`wxt: >=0.19.16`。

### 8.3 测试策略

核心设计：状态机做成纯函数 `deriveState(input) => PanelState`，其中 `input` 由三部分组成 —— 环境校验结果（`VITE_APP_URL` 是否有效）、token 读取结果（命中的 cookie 值或 null）、三个端点的拉取结果（各自为成功数据 / HTTP 状态码 / 网络异常之一）。"读 cookie"与"发请求"抽成注入的依赖，使主体逻辑不触碰 chrome API 与网络即可测试。

用仓库既有的 Vitest + jsdom，覆盖：

- cookie 名解析 —— `__Secure-` 前缀优先、回退无前缀、两者皆无返回 null
- 响应到状态的映射（重点）—— 401 → `signed-out`；500 带 `{code:-1,message}` → `error` 且取到 message；500 空 body → `error` 用状态码文案；fetch reject → `error`；2xx → `ready`
- `misconfigured` 判定 —— `VITE_APP_URL` 缺失或非法 URL
- 三端点并发中任一失败 → 整体 `error`，不部分渲染

明确不测：真实 chrome API 行为（mock `chrome.cookies`）、真实浏览器中的加载与权限授予（走手工清单）、`bearer` plugin 的 HMAC 校验（属 better-auth 职责，不重测第三方）。

服务端回归：加入 `bearer()` 后跑 root `pnpm test`，重点确认 `packages/api` 既有测试中的 cookie 认证路径未受影响。理论上不会（before 钩子仅在带 `authorization` 头时触发），但这是安全相关改动，需实测支撑。

### 8.4 手工验证清单

自动化无法覆盖但必须执行：

1. `pnpm dev:web` 起后端，`pnpm dev:extension` 起 WXT。
2. `chrome://extensions` 开启开发者模式 → 加载 `.output/chrome-mv3-dev`。
3. 未登录时打开 popup → 应为 `signed-out`，点「去登录」能开出 web 登录页。
4. 在 web 端登录后重开 popup → 应显示账户数据（CORS 风险在此步见分晓，见 9）。
5. 在 web 端登出后重开 popup → 应回到 `signed-out`。
6. 在插件内点退出 → 刷新 web 端 → web 端应也已登出。
7. 故意把 `VITE_APP_URL` 改错 → 应为 `misconfigured` 而非网络错误。

## 9. 已知风险与兜底

**CORS。** `packages/api` 当前没有任何 CORS 中间件（已确认）。按 Chrome MV3 文档，扩展页面与 service worker 在声明了 `host_permissions` 的前提下发出的跨源请求豁免 CORS。该结论按文档成立但未在本仓库实测。

处理方式为条件分支，实现第一步即验证：在 popup 中 fetch 一次 `GET /api/health`（公开无鉴权，返回 `{ status: "ok" }`，正好当探针）。

- 豁免成立 → 无需任何改动。
- 豁免不成立 → 给 `packages/api` 挂 `hono/cors`，`origin` 白名单收窄为 `chrome-extension://<extension-id>`，不使用通配符。

**extension ID 与 `trustedOrigins`。** 现有配置是 `"chrome-extension://"`（无具体 ID）。Better Auth 文档建议显式列出 extension ID，通配符会信任所有扩展。本设计不在此 spec 内改动该项（属既有配置，且开发期 ID 不稳定），但若上述 CORS 兜底被触发、需要写入具体 ID 时，应同时把 `trustedOrigins` 收窄为具体 ID。

## 10. 明确的非目标

- 不支持 Firefox 与 Safari（WXT 的 target 是配置项，作为接缝保留）。
- 不做 content script、选区读取、页面截图。
- 不做 background service worker。
- 不做积分流水、订单列表等 web 端 Settings 已覆盖的内容。
- 不在插件内实现任何登录表单或 OAuth 流程。
- 不改动 `apps/web` 的任何代码。
- 不新建 `packages/ui/ui-extension` 或 `packages/auth/src/client/extension.ts`。

## 参考来源

- [Better Auth Bearer 插件文档](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/bearer.mdx)
- [Better Auth 浏览器插件指南](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/browser-extension-guide.mdx)
- [TurboStarter 插件会话文档](https://www.turbostarter.dev/docs/extension/auth/session)
- [WXT 与 Plasmo 对比](https://wxt.dev/guide/resources/compare)
- [MDN：externally_connectable](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/manifest.json/externally_connectable)、[Bugzilla #1319168](https://bugzilla.mozilla.org/show_bug.cgi?id=1319168)
- [MDN：Chrome 与 Firefox 扩展差异](https://github.com/mdn/content/blob/main/files/en-us/mozilla/add-ons/webextensions/chrome_incompatibilities/index.md)

外部来源内容均经转述与概括，以符合许可要求。
