# openstarter 前后端一体化重构设计

- 日期:2026-06-28
- 状态:已通过 brainstorming 评审,待编写实现计划
- 范围:openstarter monorepo 的结构重构(不含新增业务功能)

## 1. 背景与动机

openstarter 由 Better-T-Stack 生成,当前是「前端 + 独立后端」的双应用架构:

- `apps/web`(TanStack Start,端口 3001)通过 CORS **跨域**调用 `apps/server`(Hono Worker,端口 3000)的 `/trpc` 与 `/api/auth/*`。
- 目标运行时是 Cloudflare Workers,部署由 `packages/infra`(Alchemy IaC)编排两个 Worker。
- 环境变量分两套:server 端从 `cloudflare:workers` 读取运行时绑定,client 端用 `@t3-oss/env-core` 校验 `VITE_` 变量,且 `packages/env/env.d.ts` 反向依赖 `infra` 的 Worker 类型形成类型闭环。

作为面向大众的开源启动模板,这套架构偏重、强绑定 Cloudflare、上手成本高。本次重构将其收敛为「前后端一体」的单一全栈应用:**前端用 TanStack Start,后端统一用 Hono,后端逻辑沉入 `packages/api`**,前后端同源、运行在 Node 上,使使用者 clone 后即可在任意 Node 环境运行。

## 2. 目标与非目标

### 目标

- 合并为单一 TanStack Start 全栈应用,前后端**同源、无 CORS**。
- 后端统一用 **Hono**:`packages/api` 导出一个 Hono app,经 TanStack Start 的 **catch-all server route** 挂载到同一应用。
- 类型安全的前后端通信改用 **Hono RPC**(`hono/client` 的 `hc<AppType>`)取代 tRPC。
- 运行时改为 **Node,平台无关**(可 Docker / VPS / Vercel / Netlify 等部署)。
- 删除 `apps/server`、`packages/config`、`packages/env`、`packages/infra`。

### 非目标

- 不再使用 tRPC(整套移除)。
- 不更换数据库引擎(保持 SQLite/Turso + Drizzle)。
- 不改动 `packages/ui`(shadcn/ui 组件)。
- 不新增业务功能,仅保留最小可运行示例。
- 不引入新的部署 IaC,仅在 README 提供 Node 部署说明。
- 不重命名 `@openstarter` scope。

## 3. 目标架构

一个 TanStack Start 应用(`apps/web`)同时承载前端与后端:

- 后端是 `packages/api` 导出的 **Hono app**(以 `/api` 为 basePath),内部挂载:
  - better-auth handler:`/api/auth/*`。
  - 业务路由(示例:`/api/health`、`/api/private-data`),用 `@hono/zod-validator` 做入参校验。
  - 一个注入 session 的 Hono 中间件(调用 `createAuth().api.getSession`,把结果写入 `c.var`)。
- `apps/web` 通过一个 catch-all server route `routes/api/$.ts` 把所有 `/api/*` 请求委托给 Hono app(`honoApp.fetch(request)`),返回的 `Response`(含 `Set-Cookie`)经 server route 透传给浏览器。同源、无 CORS、单进程。
- 前端通过 `hono/client` 的 `hc<AppType>` 获得类型安全的调用,配合 TanStack Query 做缓存与状态管理。`AppType` 由 `packages/api` 导出(`export type AppType = typeof app`),web 直接以类型方式引入(internal package、源码直出)。

请求链路(以受保护查询为例):

```
浏览器 hc client → GET /api/private-data(同源)
  → web catch-all server route (routes/api/$.ts)
  → honoApp.fetch(request)
  → Hono auth 中间件:createAuth().api.getSession(headers) → 写入 c.var.session
  → /private-data handler:校验 session(无则 401)→ 返回 JSON
  → Response 经 server route 透传(含 Set-Cookie)
  → hc client 解析为带类型的数据,交由 TanStack Query 缓存
```

## 4. 目录结构变化

### 目标结构

```
openstarter/
├── apps/
│   └── web/                          # 唯一应用:TanStack Start 全栈
│       └── src/
│           ├── routes/
│           │   ├── api/$.ts          # catch-all:委托给 packages/api 的 Hono app
│           │   └── ...               # 现有页面路由(index/login/_auth/*)
│           ├── lib/
│           │   ├── api.ts            # hc<AppType> 客户端(同源)
│           │   └── auth-client.ts    # better-auth/react 客户端(同源)
│           └── ...
├── packages/
│   ├── api/      # 后端:Hono app(auth + 业务路由 + session 中间件)+ 导出 AppType
│   ├── auth/     # better-auth 配置(自校验 BETTER_AUTH_* env)
│   ├── db/       # drizzle schema + client(自校验 DATABASE_URL)
│   └── ui/       # shadcn/ui 组件
├── tsconfig.base.json                # 从 packages/config 提到仓库根
├── turbo.json                        # 保留(编排 web 的 dev/build/check-types + db 脚本)
├── package.json
└── pnpm-workspace.yaml
```

### `packages/api` 内部结构

```
packages/api/src/
├── index.ts            # 创建 Hono app(basePath /api),组装路由与中间件,export app 与 AppType
├── middleware/
│   └── auth.ts         # session 注入中间件(getSession → c.var.session),及 requireAuth 守卫
└── routes/
    ├── health.ts       # 示例 public 路由
    └── private-data.ts # 示例 protected 路由
```

> 移除旧的 tRPC 文件:`src/index.ts` 中的 `initTRPC`、`src/context.ts`、`src/routers/index.ts` 改写为上述 Hono 结构。

### 删除 / 迁移清单

| 对象 | 处理 |
|------|------|
| `apps/server` | 删除。其 Hono(`/api/auth/*` + tRPC)逻辑迁入 `packages/api` 并改写为 Hono RPC;cors/logger 按需在 Hono 内保留(logger 可留,cors 同源后删);tsdown/wrangler/alchemy 依赖移除 |
| `packages/infra` | 删除。Alchemy IaC 整体移除;部署改为「构建 Node 产物后自行部署」,在 README 说明 |
| `packages/env` | 删除。server env 改为各包自校验 `process.env`;client env 直接用 `import.meta.env`;移除 `@t3-oss/env-core` 与 `env.d.ts` 类型链 |
| `packages/config` | 删除。`tsconfig.base.json` 提到仓库根,各 app/package 改 `extends "../../tsconfig.base.json"`(按层级调整相对路径) |
| tRPC 整套 | 删除 `@trpc/server`、`@trpc/client`、`@trpc/tanstack-react-query`、`@hono/trpc-server`;前端 `utils/trpc.ts` 与 `router.tsx` 中的 tRPC 接线一并移除 |

## 5. 详细设计

### 5.1 后端 Hono app(packages/api)

- `src/index.ts`:`const app = new Hono().basePath("/api")`;按顺序挂载 logger(可选)、session 中间件、better-auth 路由、业务路由;`export { app }` 且 `export type AppType = typeof app`。为让 `hc` 正确推断,业务路由建议采用链式定义(`new Hono().get(...).post(...)`)。
- `src/middleware/auth.ts`:中间件调用 `createAuth().api.getSession({ headers: c.req.raw.headers })`,把 `session` 写入 `c.var`;另提供 `requireAuth` 守卫,缺少 session 时返回 401。
- `src/routes/*`:示例 `health`(public,返回 OK 状态)与 `private-data`(protected,返回当前用户),入参用 `@hono/zod-validator` + zod 校验。
- `package.json`:移除 `@openstarter/env` 与所有 `@trpc/*`、`@hono/trpc-server`;新增 `hono`、`@hono/zod-validator`(zod 已有)。

### 5.2 环境变量(策略 X:各包自校验)

不设集中 env 包(避免 `api → auth → db` 回指 `api` 的循环依赖)。各包只校验自己需要的变量:

- `packages/db`:最小 zod schema 读取并校验 `DATABASE_URL`(供 `createDb()`)。
- `packages/auth`:最小 zod schema 读取并校验 `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`(供 `createAuth()`)。
- client 端:直接用 `import.meta.env`;同源后 `VITE_SERVER_URL` 不再需要,移除。
- 移除 `CORS_ORIGIN`(同源不再需要)。

所需环境变量:

| 变量 | 用途 | 必填 |
|------|------|------|
| `DATABASE_URL` | libsql/Turso 连接串(本地可用 `file:local.db` 或 `turso dev`) | 是 |
| `BETTER_AUTH_SECRET` | better-auth 会话签名密钥 | 是 |
| `BETTER_AUTH_URL` | 应用自身基址(本地默认 `http://localhost:3000`,生产填实际域名) | 是 |

### 5.3 better-auth 配置调整(packages/auth)

- auth 仍由 **Hono** 处理:在 Hono app 内 `app.on(["POST","GET"], "/auth/*", (c) => createAuth().handler(c.req.raw))`(basePath `/api` 下即 `/api/auth/*`),与现 `apps/server` 写法一致,直接迁移。
- 移除 `trustedOrigins: [env.CORS_ORIGIN]`(同源不需要);删除为 Cloudflare `*.workers.dev` 预留的 `cookieCache` / `crossSubDomainCookies` 注释配置。
- cookie 属性:`sameSite` 由 `"none"` 改为 `"lax"`(同源),`secure` 仅生产开启以便本地 http 调试,`httpOnly` 保留。
- 因 auth 走 Hono 的标准 `Request → Response`(非 TanStack Start server function),**不需要** `tanstackStartCookies` 插件;cookie 通过 Hono 返回 `Response` 的 `Set-Cookie` 透传(透传行为在实现时验证,见 §9)。
- `emailAndPassword` 等其余配置不变。

### 5.4 前端数据层(apps/web)

- 新增 `src/lib/api.ts`:`export const api = hc<AppType>("/")`(同源;`AppType` 从 `@openstarter/api` 引入)。
- 数据获取改为 `hono/client` + TanStack Query:在 `useQuery` 的 `queryFn` 内调用 `api.api.<route>.$get()/$post()` 并 `await res.json()`。具体调用路径与 `basePath("/api")` 对齐,实现时核对。
- 移除 `src/utils/trpc.ts`;`src/router.tsx` 删除 tRPC client / `createTRPCOptionsProxy` / `TRPCProvider` 接线,仅保留 `QueryClient` 与 Router 集成;`__root.tsx` 的 `RouterAppContext` 去掉 `trpc` 字段。
- `src/lib/auth-client.ts`:`baseURL` 改同源(或省略)。
- 受保护页面(`_auth/dashboard.tsx` 等)继续用 `authClient.getSession()` 守卫,数据查询换成 hono client。

### 5.5 依赖增删与构建目标

移除:

- 根 `package.json`:`@cloudflare/workers-types`、`@openstarter/env`、`@openstarter/config`(devDependency)。`turbo`、`dotenv`、`zod` 保留。
- `apps/web`:`alchemy`、`wrangler`、`@cloudflare/vite-plugin`、`@cloudflare/workers-types`、`@openstarter/env`、`@trpc/client`、`@trpc/server`、`@trpc/tanstack-react-query`。
- `apps/web/vite.config.ts`:去掉 alchemy 插件与基于 `.alchemy/local/wrangler.jsonc` 的 `cloudflare:workers` shim 条件逻辑,仅保留 `tailwindcss`、`tanstackStart`、`viteReact`。
- `packages/api`:`@openstarter/env`、`@trpc/server`、`@trpc/client`、`@hono/trpc-server`。
- `packages/auth`、`packages/db`:`@openstarter/env`(改自校验)。
- 整包删除:`packages/env`、`packages/infra`、`packages/config`。

新增 / 保留:

- 新增:`hono`、`@hono/zod-validator`(`packages/api`);`hono`(`apps/web`,用于 `hc` 客户端)。
- 保留:`@tanstack/react-query`(及其 router/ssr 集成)、`better-auth`、`drizzle-orm` 系、`zod`、`dotenv`、`react`/`react-dom`、`next-themes`、`sonner`、`lucide-react` 等。
- pnpm catalog(`pnpm-workspace.yaml`):移除不再被引用的条目 `alchemy`、`wrangler`、`@cloudflare/workers-types`、`@trpc/server`、`@trpc/client`;`hono` 保留(并被 web 复用),`better-auth`、`zod`、`dotenv`、`react`/`react-dom`、`next-themes` 保留。

构建目标:

- 配置 TanStack Start 以 **Node server** 为输出预设,`pnpm build` 产出可用 `node` 启动的服务端产物。具体预设名称/配置项在实现阶段对照 TanStack Start 1.167 文档确认。

### 5.6 .env 与数据库脚本

- `.env` 从分散(`apps/server/.env`、`apps/web/.env`、`packages/infra/.env`)收敛到单一 `apps/web/.env`。
- `packages/db/drizzle.config.ts`:`dotenv` 路径从 `../../apps/server/.env` 改为 `../../apps/web/.env`。
- `packages/db` 的 `db:local`/`db:push`/`db:generate`/`db:migrate`/`db:studio` 脚本保留。
- 新增 `apps/web/.env.example`,列出 §5.2 的三个变量及示例值。

## 6. 保留的示例

保留以下最小演示,作为模板「开箱即用」样例,改写为 Hono RPC 形态:

- 后端 Hono 路由:`/api/health`(public)、`/api/private-data`(protected)。
- 前端:首页 API Status(调 `/api/health`)、`/login`(登录/注册)、`/_auth/dashboard`(受保护,调 `/api/private-data`)、`header`/`user-menu`。

## 7. 验证方式

1. `pnpm install` 成功。
2. `pnpm dev` 以单端口启动整个应用。
3. 首页「API Status」显示 Connected(`hc` 调同源 `/api/health`)。
4. 注册 / 登录流程可用(同源 cookie 正确写入与读取)。
5. 访问 `/dashboard` 受保护路由正常,`/api/private-data` 返回当前用户。
6. `hc<AppType>` 调用具备类型推断(改错路由名/入参时类型报错)。
7. `pnpm check-types` 通过(首次 `dev`/`build` 会生成 `routeTree.gen.ts`)。
8. `pnpm build` 产出 Node server,可用 `node` 启动并访问。

## 8. 范围边界(不做什么)

- 不保留 tRPC。
- 不更换数据库引擎(仍 SQLite/Turso)。
- 不改动 `packages/ui`。
- 不新增业务功能,仅保留示例。
- 不引入新的部署 IaC(删除 Alchemy,仅在 README 写 Node 部署说明)。
- 不重命名 `@openstarter` scope。

## 9. 风险与实现时需确认的点

- **catch-all server route 挂载 Hono**:TanStack Start 1.167 中 catch-all server route(`routes/api/$.ts`)的精确导出 API,以及如何把原始 `Request` 交给 `honoApp.fetch` 并返回其 `Response`,以官方文档/社区实践为准。
- **better-auth cookie 透传**:验证经 `honoApp.fetch` 返回的 `Set-Cookie` 能被 server route 正确透传到浏览器(登录后能拿到会话 cookie);若不行,改用 better-auth 的相应集成方式处理。
- **Hono RPC 路径对齐**:`hc<AppType>` 的调用路径需与 Hono `basePath("/api")` 及链式路由定义对齐;路由需用链式写法以保证类型推断。
- **Hono RPC + TanStack Query**:无 tRPC 的自动 `queryOptions` 代理,需手写 `queryFn` 包装(本设计已采用该模式)。
- **Node 构建预设**:TanStack Start 输出 Node server 的预设名/配置项需对照文档确认。
- **路由树生成**:`routeTree.gen.ts` 为 gitignore 的生成文件,新增 `api/$.ts` 后需运行一次 `dev`/`build` 重新生成。
- **tsconfig 相对路径**:各包/应用 `extends` 仓库根 `tsconfig.base.json` 时,按层级使用正确相对路径。

## 10. 参考

- TanStack Start Server Routes:https://tanstack.com/start/latest/docs/framework/react/guide/server-routes
- Hono RPC(`hc` 客户端与 `AppType` 推断):https://hono.dev/docs/guides/rpc
- Better Auth × Hono 集成(`app.on([...], "/api/auth/*", c => auth.handler(c.req.raw))`):https://better-auth.com/docs/integrations/hono
- TanStack Start + Hono 社区示例:https://github.com/Kroro1208/tanstack-hono-start
