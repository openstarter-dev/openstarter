# openstarter 前后端一体化重构设计

- 日期:2026-06-28
- 状态:已通过 brainstorming 评审,待编写实现计划
- 范围:openstarter monorepo 的结构重构(不含新增业务功能)

## 1. 背景与动机

openstarter 由 Better-T-Stack 生成,当前是「前端 + 独立后端」的双应用架构:

- `apps/web`(TanStack Start,端口 3001)通过 CORS **跨域**调用 `apps/server`(Hono Worker,端口 3000)的 `/trpc` 与 `/api/auth/*`。
- 目标运行时是 Cloudflare Workers,部署由 `packages/infra`(Alchemy IaC)编排两个 Worker。
- 环境变量分两套:server 端从 `cloudflare:workers` 读取运行时绑定,client 端用 `@t3-oss/env-core` 校验 `VITE_` 变量,且 `packages/env/env.d.ts` 反向依赖 `infra` 的 Worker 类型形成类型闭环。

作为面向大众的开源启动模板,这套架构偏重、强绑定 Cloudflare、上手成本高(跨域配置、Alchemy、wrangler、双套 env)。本次重构将其收敛为「前后端一体」的单一全栈应用,降低复杂度与平台绑定,使使用者 clone 后即可在任意 Node 环境运行。

## 2. 目标与非目标

### 目标

- 合并为单一 TanStack Start 全栈应用,前后端**同源、无 CORS**。
- 后端逻辑归于 `packages/api`(及 `auth`/`db`),通过 TanStack Start 的 **server routes** 对外暴露。
- 运行时改为 **Node,平台无关**(可 Docker / VPS / Vercel / Netlify 等部署)。
- 删除 `apps/server`、`packages/config`、`packages/env`、`packages/infra`。

### 非目标

- 不更换数据库引擎(保持 SQLite/Turso + Drizzle)。
- 不改动 `packages/ui`(shadcn/ui 组件)。
- 不新增业务功能,仅保留最小可运行示例。
- 不引入新的部署 IaC,仅在 README 提供 Node 部署说明。
- 不重命名 `@openstarter` scope。

## 3. 目标架构

一个 TanStack Start 应用(`apps/web`)同时承载前端与后端:

- 后端通过两个 server route 暴露(同源):
  - `apps/web/src/routes/api/auth/$.ts` —— 将请求转给 `createAuth().handler(request)`。
  - `apps/web/src/routes/api/trpc/$.ts` —— 用 `@trpc/server/adapters/fetch` 的 `fetchRequestHandler` 接上 `appRouter` 与 `createContext`。
- 真正的后端逻辑仍在 packages 中(`packages/api` 的 tRPC 路由与 context、`packages/auth` 的 better-auth 配置、`packages/db` 的 schema 与 client);server route 只是落在 web 内的**极薄适配层**(TanStack Start 要求 server route 必须位于应用的 `routes/` 目录)。
- 前端的 tRPC client 与 auth client 改用**同源相对路径**(`/api/trpc`、`/api/auth`),不再需要 `VITE_SERVER_URL` 与跨域配置。

请求链路(以受保护查询为例):

```
浏览器 → /api/trpc (同源)
  → web server route (routes/api/trpc/$.ts)
  → fetchRequestHandler(appRouter, createContext)
  → createContext 用 req.headers 调 createAuth().api.getSession()
  → protectedProcedure 校验 session → 返回数据
```

## 4. 目录结构变化

### 目标结构

```
openstarter/
├── apps/
│   └── web/                      # 唯一应用:TanStack Start 全栈
│       └── src/
│           ├── routes/
│           │   ├── api/
│           │   │   ├── auth/$.ts   # 挂 better-auth handler
│           │   │   └── trpc/$.ts   # 挂 tRPC fetch handler
│           │   └── ...             # 现有页面路由(index/login/_auth/*)
│           └── ...
├── packages/
│   ├── api/      # 后端逻辑库:tRPC(init/context/routers)
│   ├── auth/     # better-auth 配置(自校验 BETTER_AUTH_* env)
│   ├── db/       # drizzle schema + client(自校验 DATABASE_URL)
│   └── ui/       # shadcn/ui 组件
├── tsconfig.base.json            # 从 packages/config 提到仓库根
├── turbo.json                    # 保留(编排 web 的 dev/build/check-types + db 脚本)
├── package.json
└── pnpm-workspace.yaml
```

### 删除 / 迁移清单

| 对象 | 处理 |
|------|------|
| `apps/server` | 删除。`/trpc`、`/api/auth` 挂载逻辑改写为 web 的 server routes;Hono / cors / logger / tsdown / wrangler / alchemy 依赖一并移除 |
| `packages/infra` | 删除。Alchemy IaC 整体移除;部署改为「构建 Node 产物后自行部署」,在 README 说明 |
| `packages/env` | 删除。server env 改为各包自校验 `process.env`;client env 直接用 `import.meta.env`(`VITE_`);移除 `@t3-oss/env-core` 与 `env.d.ts` 类型链 |
| `packages/config` | 删除。`tsconfig.base.json` 提到仓库根,各 app/package 改 `extends "../../tsconfig.base.json"`(按层级调整相对路径) |

## 5. 详细设计

### 5.1 后端接线(packages/api)

`packages/api` 保持纯后端逻辑库,改动:

- `src/context.ts`:`createContext` 当前签名依赖 Hono 的 `HonoContext` 取 `context.req.raw.headers`。改为接收标准 `Request`,即 `createAuth().api.getSession({ headers: req.headers })`;同时删除未使用的 `auth: null` 占位字段,`Context` 类型相应收敛为 `{ session }`。
- `src/index.ts`(tRPC init、`publicProcedure`、`protectedProcedure`)与 `src/routers/index.ts`(`appRouter`:`healthCheck`、`privateData`)逻辑不变。
- `package.json`:移除 `@openstarter/env` 依赖与 `hono`(devDependency);`@trpc/server` 已在依赖中,其 `adapters/fetch` 子路径供 web 适配层使用。

web 适配层(新增,极薄):

- `apps/web/src/routes/api/trpc/$.ts`:在 TanStack Start server route 的请求处理中调用 `fetchRequestHandler({ endpoint: "/api/trpc", req, router: appRouter, createContext: () => createContext({ req }) })`。
- `apps/web/src/routes/api/auth/$.ts`:GET/POST 均转发到 `createAuth().handler(request)`。

> 实现注意:TanStack Start 1.167 定义 server route 的精确导出 API(如 `createServerFileRoute`/`ServerRoute` 及 GET/POST 方法处理形态)以官方文档为准,在实现阶段对照确认。

### 5.2 环境变量(策略 X:各包自校验)

删除 `packages/env` 后,不设集中 env 包(避免 `api → auth → db` 回指 `api` 的循环依赖)。各包只校验自己需要的变量:

- `packages/db`:用最小 zod schema 读取并校验 `DATABASE_URL`(供 `createDb()` 使用)。
- `packages/auth`:用最小 zod schema 读取并校验 `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`(供 `createAuth()` 使用)。
- client 端:直接用 `import.meta.env` 读取 `VITE_` 变量。同源后 `VITE_SERVER_URL` 不再需要,予以移除。
- 移除 `CORS_ORIGIN`(同源不再需要)。

所需环境变量收敛为:

| 变量 | 用途 | 必填 |
|------|------|------|
| `DATABASE_URL` | libsql/Turso 连接串(本地可用 `file:local.db` 或 `turso dev`) | 是 |
| `BETTER_AUTH_SECRET` | better-auth 会话签名密钥 | 是 |
| `BETTER_AUTH_URL` | 应用自身基址(本地默认 `http://localhost:3000`,生产填实际域名) | 是 |

### 5.3 better-auth 配置调整(packages/auth)

- 启用 better-auth 的 `tanstackStartCookies` 插件(TanStack Start 下写入 cookie 需要它)。
- 移除 `trustedOrigins: [env.CORS_ORIGIN]`(同源不需要)。
- 删除为 Cloudflare `*.workers.dev` 预留的 `session.cookieCache` 与 `advanced.crossSubDomainCookies` 注释配置。
- cookie 属性:`sameSite` 从 `"none"` 改为 `"lax"`(同源),`secure` 仅在生产开启以便本地 http 调试;`httpOnly` 保留。
- `emailAndPassword` 等其余配置不变。

### 5.4 前端 client 调整(apps/web)

- `src/router.tsx`:tRPC `httpBatchLink` 的 `url` 从 `${env.VITE_SERVER_URL}/trpc` 改为同源 `/api/trpc`;移除对 `@openstarter/env/web` 的引用(`credentials: "include"` 同源下可保留,无副作用)。
- `src/lib/auth-client.ts`:`baseURL` 改为同源(可省略,使其默认指向当前 origin)。

### 5.5 依赖增删与构建目标

移除的依赖/配置:

- 根 `package.json`:`@cloudflare/workers-types`、`@openstarter/env`、`@openstarter/config`(devDependency)。`turbo`、`dotenv`、`zod` 保留。
- `apps/web`:`alchemy`、`wrangler`、`@cloudflare/vite-plugin`、`@cloudflare/workers-types`、`@openstarter/env`。
- `apps/web/vite.config.ts`:去掉 alchemy 插件与基于 `.alchemy/local/wrangler.jsonc` 的 `cloudflare:workers` shim 条件逻辑,仅保留 `tailwindcss`、`tanstackStart`、`viteReact`。
- `packages/api`:`@openstarter/env`、`hono`。
- `packages/auth`:`@openstarter/env`(改自校验)。
- `packages/db`:`@openstarter/env`(改自校验)。
- 整包删除:`packages/env`、`packages/infra`、`packages/config`。
- pnpm catalog(`pnpm-workspace.yaml`):移除不再被引用的条目 `alchemy`、`wrangler`、`@cloudflare/workers-types`、`hono`;`@trpc/server`、`@trpc/client`、`better-auth`、`zod`、`dotenv`、`react`/`react-dom`、`next-themes` 等仍被引用,保留。

构建目标:

- 配置 TanStack Start 以 **Node server** 为输出预设,`pnpm build` 产出可用 `node` 启动的服务端产物。具体预设名称/配置项在实现阶段对照 TanStack Start 1.167 文档确认。

### 5.6 .env 与数据库脚本

- `.env` 从分散(`apps/server/.env`、`apps/web/.env`、`packages/infra/.env`)收敛到单一 `apps/web/.env`。
- `packages/db/drizzle.config.ts`:`dotenv` 路径从 `../../apps/server/.env` 改为 `../../apps/web/.env`。
- `packages/db` 的 `db:local`/`db:push`/`db:generate`/`db:migrate`/`db:studio` 脚本保留。
- 新增 `apps/web/.env.example`,列出 §5.2 的三个变量及示例值。

## 6. 保留的示例

保留以下最小演示,作为模板「开箱即用」样例,不清空:

- tRPC:`healthCheck`(public)、`privateData`(protected)。
- 页面:首页 API Status、`/login`(登录/注册表单)、`/_auth/dashboard`(受保护)、`header`/`user-menu`。

## 7. 验证方式

1. `pnpm install` 成功。
2. `pnpm dev` 以单端口启动整个应用。
3. 首页「API Status」显示 Connected(`healthCheck` 走同源 `/api/trpc`)。
4. 注册 / 登录流程可用(同源 cookie 正确写入与读取)。
5. 访问 `/dashboard` 受保护路由正常,`privateData` 返回当前用户。
6. `pnpm check-types` 通过(首次 `dev`/`build` 会生成 `routeTree.gen.ts`)。
7. `pnpm build` 产出 Node server,可用 `node` 启动并访问。

## 8. 范围边界(不做什么)

- 不更换数据库引擎(仍 SQLite/Turso)。
- 不改动 `packages/ui`。
- 不新增业务功能,仅保留示例。
- 不引入新的部署 IaC(删除 Alchemy,仅在 README 写 Node 部署说明)。
- 不重命名 `@openstarter` scope。

## 9. 风险与实现时需确认的点

- **TanStack Start server route 的精确 API**:1.167 版本定义 server route 与 GET/POST 处理的导出形态,以官方文档为准。
- **Node 构建预设**:TanStack Start 输出 Node server 的预设名/配置项需对照文档确认。
- **better-auth `tanstackStartCookies` 用法**:插件引入位置与配置以 better-auth 官方 TanStack Start 集成文档为准。
- **路由树生成**:`routeTree.gen.ts` 为 gitignore 的生成文件,新增 `api/*` server route 后需运行一次 `dev`/`build` 重新生成,`check-types` 才能通过。
- **tsconfig 相对路径**:各包/应用 `extends` 仓库根 `tsconfig.base.json` 时,按目录层级使用正确的相对路径。

## 10. 参考

- Better Auth × TanStack Start 集成(handler 挂载到 `src/routes/api/auth/$.ts`、`tanstackStartCookies` 插件):https://better-auth.com/docs/integrations/tanstack
- TanStack Start Server Routes:https://tanstack.com/start/latest/docs/framework/react/guide/server-routes
