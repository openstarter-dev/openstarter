# 前后端一体化重构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 superpowers:subagent-driven-development(推荐)或 superpowers:executing-plans 逐任务执行本计划。步骤用 checkbox(`- [ ]`)跟踪。

**Goal:** 把 openstarter 从「TanStack Start 前端 + 独立 Hono server + tRPC」双应用,重构为「单一 TanStack Start 全栈应用,后端是 packages/api 里的 Hono app,前后端用 Hono RPC 同源通信」,并删除 config/env/infra 三个包与独立 server。

**Architecture:** `packages/api` 导出一个 Hono app(挂 better-auth `/api/auth/*` + 业务路由)及其 `AppType`;`apps/web` 用 catch-all server route `routes/api/$.ts` 把 `/api/*` 委托给 `app.fetch(request)`;前端用 `hono/client` 的 `hc<AppType>` 配合 TanStack Query 调用。Node 运行时,环境变量各包自校验。

**Tech Stack:** TanStack Start(React 19)、Hono + Hono RPC、@hono/zod-validator、better-auth、Drizzle + libsql/Turso、Zod、pnpm + Turborepo。

## Global Constraints

- 包管理器:pnpm 10.25;monorepo 用 Turborepo,保留 `turbo`。
- 运行时:Node、平台无关。生产构建产物为 `apps/web/dist/server/server.js`,用 `node` 启动。
- 同源:前后端同源、无 CORS。开发端口统一 `3000`。
- 环境变量(策略 X·各包自校验):`packages/db` 校验 `DATABASE_URL`;`packages/auth` 校验 `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`;client 用 `import.meta.env`。
- 移除:tRPC 全套(`@trpc/*`、`@hono/trpc-server`)、Cloudflare/Alchemy 全套(`alchemy`、`wrangler`、`@cloudflare/vite-plugin`、`@cloudflare/workers-types`)、`@t3-oss/env-core`、`tsdown`。
- 保留:`@openstarter` 命名、`packages/ui`、SQLite/Turso + Drizzle、示例端点(health/private-data)与页面(login/signup/dashboard)。
- 代码规范:遵循仓库 ultracite/Biome(禁止 `any`、禁止 TS enum、`import type` 等)。
- 设计来源:`docs/superpowers/specs/2026-06-28-fullstack-unification-design.md`。

---

### Task 1: 删除独立 server 应用与部署脚本

**Files:**
- Delete: `apps/server/`(整个目录)
- Modify: `package.json`(根,删 `dev:server`/`deploy`/`destroy` 脚本)
- Modify: `turbo.json`(删 `deploy`/`destroy` 任务)

**Interfaces:**
- Consumes: 无
- Produces: 仓库不再有 `apps/server`,根脚本不再引用 server/infra 部署

- [x] **Step 1: 删除 server 应用目录**

```bash
git rm -r apps/server
```

- [x] **Step 2: 删除根 package.json 中的 server/部署脚本**

打开 `package.json`,删除以下三行脚本(保留其余):

```json
    "dev:server": "turbo -F server dev",
    "deploy": "turbo -F @openstarter/infra deploy",
    "destroy": "turbo -F @openstarter/infra destroy"
```

注意删除后确保上一行 `"dev:web": "turbo -F web dev",` 与后续 `db:*` 脚本之间逗号合法(`dev:web` 行末尾保留逗号)。

- [x] **Step 3: 删除 turbo.json 中的部署任务**

打开 `turbo.json`,在 `tasks` 中删除 `deploy` 与 `destroy` 两个任务块:

```json
    "deploy": {
      "cache": false
    },
    "destroy": {
      "cache": false
    }
```

- [x] **Step 4: 重新安装并确认 workspace 正常**

Run: `pnpm install`
Expected: 安装成功,无 `apps/server` 相关报错。

确认 server 目录已不存在:
Run: `ls apps`
Expected: 仅输出 `web`。

- [x] **Step 5: 提交**

```bash
git add apps package.json turbo.json pnpm-lock.yaml
git commit -m "refactor: 删除独立 server 应用与 Cloudflare 部署脚本"
```

> 说明:此时 `packages/infra`/`packages/env` 仍保留(`env.d.ts` 仍引用 `infra`),将在 Task 5 统一删除。`turbo dev` 暂时仍会触发 `infra` 的 `alchemy dev`,Task 4 起改用 `pnpm --filter web dev` 验证,Task 5 删除 infra 后根 `dev` 恢复干净。

---

### Task 2: packages/db 改为自校验环境变量

**Files:**
- Create: `packages/db/src/env.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/package.json`(移除 `@openstarter/env`,新增 `check-types` 脚本)
- Modify: `packages/db/tsconfig.json`(简化为 `noEmit`,支持独立类型检查)

**Interfaces:**
- Produces: `createDb()` 签名不变;新增内部 `env`(含 `DATABASE_URL: string`)

- [x] **Step 1: 新建 db 的 env 自校验**

`packages/db/src/env.ts`:

```ts
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
});

export const env = schema.parse(process.env);
```

- [x] **Step 2: 改 index.ts 使用本地 env**

`packages/db/src/index.ts` 全文替换为:

```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "./env";
import * as schema from "./schema";

export function createDb() {
  const client = createClient({ url: env.DATABASE_URL });
  return drizzle({ client, schema });
}
```

- [x] **Step 3: 调整 db 的 package.json**

`packages/db/package.json`:在 `dependencies` 删除 `"@openstarter/env": "workspace:*",`;在 `scripts` 增加 `check-types`(置于 `db:migrate` 之后):

```json
    "db:migrate": "drizzle-kit migrate",
    "check-types": "tsc --noEmit"
```

- [x] **Step 4: 简化 db 的 tsconfig 以支持独立类型检查**

`packages/db/tsconfig.json` 全文替换为:

```json
{
  "extends": "@openstarter/config/tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  }
}
```

- [x] **Step 5: 独立类型检查**

Run: `pnpm --filter @openstarter/db check-types`
Expected: PASS,无类型错误,且不再引用 `@openstarter/env`。

确认未残留旧引用:
Run: `grep -rn "@openstarter/env" packages/db/src`
Expected: 无输出。

- [x] **Step 6: 提交**

```bash
git add packages/db
git commit -m "refactor(db): 用本地 zod 校验 DATABASE_URL,移除 @openstarter/env 依赖"
```

---

### Task 3: packages/auth 自校验环境变量并调整为同源 cookie

**Files:**
- Create: `packages/auth/src/env.ts`
- Modify: `packages/auth/src/index.ts`
- Modify: `packages/auth/package.json`(移除 `@openstarter/env`,新增 `check-types`)
- Modify: `packages/auth/tsconfig.json`(简化为 `noEmit`)

**Interfaces:**
- Consumes: `createDb()`(来自 Task 2)
- Produces: `createAuth()` 签名不变(返回 better-auth 实例,含 `.handler`、`.api.getSession`)

- [x] **Step 1: 新建 auth 的 env 自校验**

`packages/auth/src/env.ts`:

```ts
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
});

export const env = schema.parse(process.env);
```

- [x] **Step 2: 改写 auth/index.ts(本地 env + 同源 cookie)**

`packages/auth/src/index.ts` 全文替换为:

```ts
import { createDb } from "@openstarter/db";
import * as schema from "@openstarter/db/schema/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { env } from "./env";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
      },
    },
  });
}
```

说明:删除了 `trustedOrigins`(同源不需要)与所有 Cloudflare `*.workers.dev` 注释配置;`sameSite` 由 `none` 改为 `lax`,`secure` 仅生产开启。

- [x] **Step 3: 调整 auth 的 package.json**

`packages/auth/package.json`:在 `dependencies` 删除 `"@openstarter/env": "workspace:*",`;在 `scripts` 增加:

```json
  "scripts": {
    "check-types": "tsc --noEmit"
  },
```

- [x] **Step 4: 简化 auth 的 tsconfig**

`packages/auth/tsconfig.json` 全文替换为:

```json
{
  "extends": "@openstarter/config/tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  }
}
```

- [x] **Step 5: 独立类型检查**

Run: `pnpm --filter @openstarter/auth check-types`
Expected: PASS。

Run: `grep -rn "@openstarter/env" packages/auth/src`
Expected: 无输出。

- [x] **Step 6: 提交**

```bash
git add packages/auth
git commit -m "refactor(auth): 自校验 BETTER_AUTH_* 并改为同源 lax cookie"
```

---

### Task 4: 切换 RPC 机制(packages/api 改 Hono + apps/web 改 Hono RPC)

> 本任务是一次原子的「RPC 机制切换」:完成 api 部分后 web 仍引用旧 API,属预期的中间不一致;web 部分完成后统一类型检查。分两个提交(api、web)。

**Files:**
- Delete: `packages/api/src/context.ts`、`packages/api/src/routers/index.ts`、`apps/web/src/utils/trpc.ts`
- Create: `packages/api/src/middleware/auth.ts`、`packages/api/src/routes/health.ts`、`packages/api/src/routes/private-data.ts`、`apps/web/src/lib/api.ts`、`apps/web/src/routes/api/$.ts`
- Modify: `packages/api/src/index.ts`、`packages/api/package.json`、`packages/api/tsconfig.json`、`apps/web/src/routes/index.tsx`、`apps/web/src/routes/_auth/dashboard.tsx`、`apps/web/src/router.tsx`、`apps/web/src/routes/__root.tsx`、`apps/web/src/lib/auth-client.ts`、`apps/web/package.json`、`apps/web/vite.config.ts`、`apps/web/.env`

**Interfaces:**
- Consumes: `createAuth()`(Task 3)— 提供 `.handler(req)` 与 `.api.getSession({ headers })`
- Produces:
  - `app`(Hono 实例,`app.fetch(request) => Response`)
  - `type AppType = typeof routes`(供 `hc<AppType>`)
  - 路由:`GET /api/health` → `{ status: "ok" }`;`GET /api/private-data` → `{ message: string; user?: User }`(401 时 `{ message: "Unauthorized" }`);`/api/auth/*` → better-auth
  - 前端:`client = hc<AppType>("/")`,调用 `client.api.health.$get()`、`client.api["private-data"].$get()`

- [x] **Step 1: 删除 api 旧 tRPC 文件**

```bash
git rm packages/api/src/context.ts packages/api/src/routers/index.ts
```

- [x] **Step 2: 新建 session 注入中间件**

`packages/api/src/middleware/auth.ts`:

```ts
import { createAuth } from "@openstarter/auth";
import { createMiddleware } from "hono/factory";

type Session = Awaited<
  ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>
>;

export const authMiddleware = createMiddleware<{
  Variables: { session: Session };
}>(async (c, next) => {
  const session = await createAuth().api.getSession({
    headers: c.req.raw.headers,
  });
  c.set("session", session);
  await next();
});
```

- [x] **Step 3: 新建 health 路由(public)**

`packages/api/src/routes/health.ts`:

```ts
import { Hono } from "hono";

export const healthRoute = new Hono().get("/api/health", (c) =>
  c.json({ status: "ok" as const })
);
```

- [x] **Step 4: 新建 private-data 路由(protected)**

`packages/api/src/routes/private-data.ts`:

```ts
import { Hono } from "hono";

import { authMiddleware } from "../middleware/auth";

export const privateDataRoute = new Hono().get(
  "/api/private-data",
  authMiddleware,
  (c) => {
    const session = c.get("session");
    if (!session) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    return c.json({ message: "This is private", user: session.user });
  }
);
```

- [x] **Step 5: 改写 api/index.ts 为 Hono app 并导出 AppType**

`packages/api/src/index.ts` 全文替换为:

```ts
import { createAuth } from "@openstarter/auth";
import { Hono } from "hono";

import { healthRoute } from "./routes/health";
import { privateDataRoute } from "./routes/private-data";

const app = new Hono();

app.on(["POST", "GET"], "/api/auth/*", (c) => createAuth().handler(c.req.raw));

const routes = app.route("/", healthRoute).route("/", privateDataRoute);

export { app };
export type AppType = typeof routes;
```

说明:`app.fetch(request)` 由 web 的 catch-all server route 调用;`AppType` 仅包含链式业务路由(health/private-data),供 `hc` 推断,auth 通配路由不参与 RPC。

- [x] **Step 6a: 改 api/package.json**

`packages/api/package.json` 全文替换为(hono 移入 dependencies,删 tRPC 与 env,新增 check-types):

```json
{
  "name": "@openstarter/api",
  "type": "module",
  "exports": {
    ".": {
      "default": "./src/index.ts"
    },
    "./*": {
      "default": "./src/*.ts"
    }
  },
  "scripts": {
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@openstarter/auth": "workspace:*",
    "@openstarter/db": "workspace:*",
    "hono": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@openstarter/config": "workspace:*",
    "typescript": "catalog:"
  }
}
```

- [x] **Step 6b: 简化 api/tsconfig.json**

`packages/api/tsconfig.json` 全文替换为:

```json
{
  "extends": "@openstarter/config/tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  }
}
```

- [x] **Step 7: 安装 Hono 校验器并重装依赖**

```bash
pnpm --filter @openstarter/api add @hono/zod-validator
pnpm install
```

说明:`@hono/zod-validator` 为模板预置的入参校验中间件,供后续业务路由使用(示例路由暂未用到)。

- [x] **Step 8: api 独立类型检查**

Run: `pnpm --filter @openstarter/api check-types`
Expected: PASS。

- [x] **Step 9: 提交 api 改造**

```bash
git add packages/api pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "refactor(api): 用 Hono + Hono RPC 重写,导出 app 与 AppType"
```

- [x] **Step 10: 新建前端 Hono RPC 客户端**

`apps/web/src/lib/api.ts`:

```ts
import type { AppType } from "@openstarter/api";
import { hc } from "hono/client";

export const client = hc<AppType>("/");
```

- [x] **Step 11: 新建 catch-all server route(委托给 Hono app)**

`apps/web/src/routes/api/$.ts`:

```ts
import { app } from "@openstarter/api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: ({ request }) => app.fetch(request),
      POST: ({ request }) => app.fetch(request),
      PUT: ({ request }) => app.fetch(request),
      PATCH: ({ request }) => app.fetch(request),
      DELETE: ({ request }) => app.fetch(request),
    },
  },
});
```

- [x] **Step 12: 首页改用 Hono RPC 调 health**

在 `apps/web/src/routes/index.tsx`,把这行 import:

```ts
import { useTRPC } from "@/utils/trpc";
```

替换为:

```ts
import { client } from "@/lib/api";
```

然后把整个 `HomeComponent` 函数替换为下方版本(`TITLE_TEXT` 常量保持不变):

```tsx
function HomeComponent() {
  const healthCheck = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await client.api.health.$get();
      return res.json();
    },
  });

  const connected = healthCheck.data?.status === "ok";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-2">
      <pre className="overflow-x-auto font-mono text-sm">{TITLE_TEXT}</pre>
      <div className="grid gap-6">
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">API Status</h2>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-muted-foreground text-sm">
              {healthCheck.isLoading
                ? "Checking..."
                : connected
                  ? "Connected"
                  : "Disconnected"}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [x] **Step 13: dashboard 改用 Hono RPC 调 private-data**

`apps/web/src/routes/_auth/dashboard.tsx` 全文替换为:

```tsx
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { client } from "@/lib/api";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();

  const privateData = useQuery({
    queryKey: ["private-data"],
    queryFn: async () => {
      const res = await client.api["private-data"].$get();
      return res.json();
    },
  });

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome {session.data?.user.name}</p>
      <p>API: {privateData.data?.message}</p>
    </div>
  );
}
```

- [x] **Step 14: 清理 router.tsx 的 tRPC 接线(三处改动)**

改动 1 — 替换顶部 import 块:

```tsx
import type { AppRouter } from "@openstarter/api/routers/index";
import { env } from "@openstarter/env/web";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";
import { TRPCProvider } from "./utils/trpc";
```

替换为:

```tsx
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { toast } from "sonner";

import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";
```

改动 2 — 删除整个 `trpcClient` 常量定义(连同其后空行):

```tsx
const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.VITE_SERVER_URL}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});
```

改动 3 — 把 `getRouter` 开头到 `createTanStackRouter({...})` 这段:

```tsx
  const queryClient = createQueryClient();
  const trpc = createTRPCOptionsProxy({
    client: trpcClient,
    queryClient,
  });

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: { trpc, queryClient },
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    Wrap: ({ children }) => (
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    ),
  });
```

替换为:

```tsx
  const queryClient = createQueryClient();

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: { queryClient },
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    ),
  });
```

- [x] **Step 15: 清理 __root.tsx 的 tRPC context**

在 `apps/web/src/routes/__root.tsx`,把顶部到 `RouterAppContext` 接口这一段:

```tsx
import type { AppRouter } from "@openstarter/api/routers/index";
import { Toaster } from "@openstarter/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import Header from "../components/header";

import appCss from "../index.css?url";
export interface RouterAppContext {
  trpc: TRPCOptionsProxy<AppRouter>;
  queryClient: QueryClient;
}
```

替换为:

```tsx
import { Toaster } from "@openstarter/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import Header from "../components/header";

import appCss from "../index.css?url";
export interface RouterAppContext {
  queryClient: QueryClient;
}
```

- [x] **Step 16: 删除前端 tRPC 工具文件**

```bash
git rm apps/web/src/utils/trpc.ts
```

- [x] **Step 17: auth-client 改为同源**

`apps/web/src/lib/auth-client.ts` 全文替换为:

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
```

说明:省略 `baseURL`,better-auth client 默认请求当前 origin 的 `/api/auth/*`,与后端同源挂载点一致。

- [x] **Step 18a: 改 web 的 scripts(dev/start)**

`apps/web/package.json` 的 `scripts` 块:

```json
  "scripts": {
    "build": "vite build",
    "serve": "vite preview",
    "dev:bare": "vite dev"
  },
```

替换为:

```json
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "node dist/server/server.js",
    "serve": "vite preview"
  },
```

- [x] **Step 18b: 改 web 的依赖(删 tRPC/env,加 hono)**

在 `apps/web/package.json` 的 `dependencies` 中删除这四行:

```json
    "@openstarter/env": "workspace:*",
    "@trpc/client": "catalog:",
    "@trpc/server": "catalog:",
    "@trpc/tanstack-react-query": "^11.16.0",
```

并新增一行(置于 `better-auth` 之前):

```json
    "hono": "catalog:",
```

- [x] **Step 19: 清理 vite.config.ts(移除 alchemy/cloudflare,端口 3000)**

`apps/web/vite.config.ts` 全文替换为:

```ts
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});
```

说明:删除了 alchemy 插件、`.alchemy/local/wrangler.jsonc` 检测与 `cloudflare:workers` shim alias;端口固定 3000。

- [x] **Step 20: 设置 apps/web/.env(开发用,本地文件)**

将 `apps/web/.env` 内容设为:

```
DATABASE_URL=file:../../local.db
BETTER_AUTH_SECRET=dev-secret-change-me-please-at-least-32-chars
BETTER_AUTH_URL=http://localhost:3000
```

说明:`file:../../local.db` 相对 cwd 解析,使 `packages/db`(drizzle-kit)与 `apps/web`(应用)都指向仓库根同一个 `local.db`。

- [x] **Step 20b: 修正 drizzle.config 的 env 路径**

`packages/db/drizzle.config.ts` 中:

```ts
dotenv.config({
  path: "../../apps/server/.env",
});
```

改为:

```ts
dotenv.config({
  path: "../../apps/web/.env",
});
```

- [x] **Step 21: 重装并构建(生成 routeTree)**

```bash
pnpm install
pnpm --filter web build
```
Expected: 安装成功;构建成功,生成 `apps/web/src/routeTree.gen.ts`(含新 `/api/$` 路由)与 `apps/web/dist/server/server.js`。

- [x] **Step 22: 全量类型检查**

Run: `pnpm check-types`
Expected: PASS(web、ui、api、auth、db 全部通过;不再有 tRPC 相关引用)。

确认无残留:
Run: `grep -rn "@trpc/\|utils/trpc\|VITE_SERVER_URL" apps/web/src packages/api/src`
Expected: 无输出。

- [x] **Step 23: 提交 web 改造**

```bash
git add apps/web packages pnpm-lock.yaml
git commit -m "refactor(web): 切换到 Hono RPC 与同源 API,移除 tRPC 接线"
```

- [x] **Step 24: 端到端手动验证**

```bash
pnpm db:push
```
Expected: 在仓库根生成 `local.db` 并建好 better-auth 四张表。

然后在一个独立终端手动启动开发服务器(长驻进程,勿在脚本中阻塞):

```bash
pnpm --filter web dev
```

依次验证:
1. 浏览器打开 `http://localhost:3000` → 首页「API Status」显示 **Connected**。
2. 另开终端:`curl http://localhost:3000/api/health` → 返回 `{"status":"ok"}`。
3. 打开 `/login`,注册新用户并登录成功(检查浏览器已写入会话 cookie)。
4. 访问 `/dashboard` → 显示「Welcome <用户名>」与「API: This is private」。
5. 验证通过后停止 dev 服务器。

> 若登录后 cookie 未写入,排查 better-auth 经 `app.fetch` 返回的 `Set-Cookie` 是否被 server route 透传(见设计 §9)。

---

### Task 5: 删除 config/env/infra,重组 tsconfig 与 catalog

**Files:**
- Create: `tsconfig.base.json`(仓库根)
- Modify: `tsconfig.json`(根)、`packages/{api,auth,db,ui}/tsconfig.json`、`apps/web/package.json`、`package.json`(根)、`pnpm-workspace.yaml`
- Delete: `packages/config/`、`packages/env/`、`packages/infra/`

**Interfaces:** 无新增接口(纯清理与配置迁移)

- [x] **Step 1: 把 tsconfig.base.json 提到仓库根**

新建仓库根 `tsconfig.base.json`(内容来自 `packages/config/tsconfig.base.json`,`types` 去掉 `@cloudflare/workers-types`):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "verbatimModuleSyntax": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["node"]
  }
}
```

- [x] **Step 2: 改根 tsconfig.json 的 extends**

`tsconfig.json`(根)全文替换为:

```json
{
  "extends": "./tsconfig.base.json"
}
```

- [x] **Step 3: 改四个包 tsconfig 的 extends**

在 `packages/api/tsconfig.json`、`packages/auth/tsconfig.json`、`packages/db/tsconfig.json`、`packages/ui/tsconfig.json` 中,把这一行:

```json
  "extends": "@openstarter/config/tsconfig.base.json",
```

改为:

```json
  "extends": "../../tsconfig.base.json",
```

（`apps/web/tsconfig.json` 本就不 extends,无需改动。）

- [x] **Step 4: 移除对 config/env 与 Cloudflare 包的依赖**

```bash
pnpm --filter @openstarter/api --filter @openstarter/auth --filter @openstarter/db --filter @openstarter/ui remove @openstarter/config
pnpm --filter web remove alchemy wrangler @cloudflare/vite-plugin @cloudflare/workers-types @openstarter/config
pnpm remove -w @openstarter/env @openstarter/config @cloudflare/workers-types
```

说明:以上命令会更新各 `package.json` 与 lockfile。此时 `config/env/infra` 目录仍在,但已无人依赖。

- [x] **Step 5: 删除三个包目录**

```bash
git rm -r packages/config packages/env packages/infra
```

- [x] **Step 6: 清理 pnpm catalog**

在 `pnpm-workspace.yaml` 的 `catalog:` 中删除以下五行(已无人引用):

```yaml
  "@cloudflare/workers-types": ^4.20260621.1
  "@trpc/server": ^11.16.0
  alchemy: ^0.91.2
  wrangler: ^4.103.0
  "@trpc/client": ^11.16.0
```

保留 `dotenv`、`zod`、`typescript`、`@types/node`、`hono`、`better-auth`、`next-themes`、`react`、`react-dom`、`@types/react`、`@types/react-dom`。

- [x] **Step 7: 重装依赖**

```bash
pnpm install
```
Expected: 安装成功,无对 `@openstarter/config`、`@openstarter/env`、`@openstarter/infra` 的解析错误。

- [x] **Step 8: 验证类型与构建**

Run: `pnpm check-types`
Expected: PASS。

Run: `pnpm --filter web build`
Expected: 构建成功。

Run: `grep -rn "@openstarter/config\|@openstarter/env\|@openstarter/infra\|cloudflare:workers" apps packages --include=*.ts --include=*.tsx --include=*.json`
Expected: 无输出。

- [x] **Step 9: 提交清理**

```bash
git add tsconfig.base.json tsconfig.json packages apps/web/package.json package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "refactor: 删除 config/env/infra 包,tsconfig 提到仓库根"
```

---

### Task 6: 更新文档与最终端到端验证

**Files:**
- Modify: `.gitignore`(根)、`README.md`

**Interfaces:** 无

- [x] **Step 1: 忽略本地数据库文件**

在根 `.gitignore` 末尾追加:

```
# 本地 SQLite 数据库
local.db
local.db-*
```

- [x] **Step 1b: 新建 apps/web/.env.example(纳入版本控制)**

`apps/web/.env.example`:

```
DATABASE_URL=file:../../local.db
BETTER_AUTH_SECRET=replace-with-a-strong-secret-at-least-32-chars
BETTER_AUTH_URL=http://localhost:3000
```

> 若该文件被 `apps/web/.gitignore` 的 `.env*` 规则忽略,在该 `.gitignore` 加一行 `!.env.example` 取消忽略。

- [x] **Step 2: 更新 README.md(替换以下四个章节的内容)**

替换 **Features** 列表为:

```markdown
- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - Full-stack SSR framework on TanStack Router (unified front + back)
- **TailwindCSS** - Utility-first CSS
- **Shared UI package** - shadcn/ui primitives in `packages/ui`
- **Hono** - Lightweight backend framework (in `packages/api`)
- **Hono RPC** - End-to-end type-safe client/server calls
- **Node** - Platform-agnostic runtime
- **Drizzle** - TypeScript-first ORM
- **SQLite/Turso** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system
```

替换 **Project Structure** 为:

```
openstarter/
├── apps/
│   └── web/         # Full-stack app (TanStack Start + Hono via server routes)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # Hono app (auth + routes) + AppType for RPC
│   ├── auth/        # Better-Auth configuration
│   └── db/          # Database schema & client
```

替换 **Available Scripts** 为:

```markdown
- `pnpm dev`: Start the app in development mode (http://localhost:3000)
- `pnpm build`: Build the app for production
- `pnpm --filter web start`: Run the production Node server
- `pnpm check-types`: Type-check across the workspace
- `pnpm db:push` / `db:generate` / `db:migrate` / `db:studio` / `db:local`: Drizzle commands
```

替换 **Deployment** 章节为:

```markdown
## Deployment

The app builds to a standard Node server (`apps/web/dist/server/server.js`).

1. Build: `pnpm build`
2. Start: `pnpm --filter web start`

Provide `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` as environment
variables on your host. Deploy anywhere Node runs (Docker, VPS, Vercel, Netlify).
```

同时把 **Database Setup** 中提到的 `apps/server/.env` 改为 `apps/web/.env`(环境变量集中在此文件)。删除原 README 中所有提到 Cloudflare / Alchemy / `pnpm run deploy` 的内容。

- [x] **Step 3: 最终端到端验证**

```bash
pnpm install
pnpm check-types
pnpm build
pnpm db:push
```
Expected: 全部成功;`local.db` 建好四张表。

手动验证生产产物启动(独立终端,长驻):

```bash
pnpm --filter web start
```
- `curl http://localhost:3000/api/health` → `{"status":"ok"}`
- 浏览器 `http://localhost:3000` 首页「API Status」= Connected。

> 注:生产构建中 `NODE_ENV=production`,cookie `secure=true` 需 HTTPS;本地用 `node` 启动仅验证服务可用与 health。登录/会话流程已在 Task 4 的 `pnpm --filter web dev`(`secure=false`)下验证。

- [x] **Step 4: 提交文档**

```bash
git add .gitignore README.md apps/web/.env.example
git commit -m "docs: 更新 README 为 Node 部署与 Hono RPC 架构"
```

---

## 完成标准(验收)

- [x] 仓库仅含 `apps/web` 一个应用;`packages/` 仅 `api`/`auth`/`db`/`ui`。
- [x] 无 `apps/server`、`packages/config`、`packages/env`、`packages/infra`。
- [x] `grep` 无 tRPC、`@openstarter/{config,env,infra}`、Cloudflare/Alchemy、`cloudflare:workers` 残留。
- [x] `pnpm check-types` 与 `pnpm build` 通过。
- [x] `pnpm dev` 单端口 3000 启动;首页 health=Connected;注册/登录/`/dashboard` 正常。
- [x] 前后端同源,`/api/*` 由 `packages/api` 的 Hono app 处理,前端经 `hc<AppType>` 类型安全调用。
- [x] 生产:`pnpm build` 产出 `dist/server/server.js`,`pnpm --filter web start` 可启动。
