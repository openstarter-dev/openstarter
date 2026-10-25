// 回归测试：intent 预加载的 loader 接线契约（与 router.tsx 的 defaultPreload:"intent" 配套）。
// 1) 每个数据路由都有 loader，且预取的 queryKey 与组件挂载时 useQuery 的 key 一致（缓存才能命中）。
// 2) loader 必须吞掉取数错误（prefetchQuery 语义），不得升级为导航失败（ensureQueryData 会抛，
//    会把组件自带的内联错误 UI 变成整页 ErrorPage）。

import { QueryClient } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as DashboardRoute } from "./_app/dashboard";
import { Route as AccountsRoute } from "./_app/settings/accounts";
import { Route as ApiKeysRoute } from "./_app/settings/apikeys";
import { Route as BillingRoute } from "./_app/settings/billing";
import { Route as CreditsRoute } from "./_app/settings/credits";
import { Route as PaymentsRoute } from "./_app/settings/payments";
import { Route as SessionsRoute } from "./_app/settings/sessions";
import { Route as TicketsRoute } from "./_app/settings/tickets";
import { Route as AdminIndexRoute } from "./admin/index";
import { Route as AdminAiModelsRoute } from "./admin/ai-models";
import { Route as AdminCreditsRoute } from "./admin/credits";
import { Route as AdminOrdersRoute } from "./admin/orders";
import { Route as AdminRolesRoute } from "./admin/roles";
import { Route as AdminSettingsRoute } from "./admin/settings";
import { Route as AdminSubscriptionsRoute } from "./admin/subscriptions";
import { Route as AdminUsersRoute } from "./admin/users";

// 组件挂载时消费的同款 key（分页页对齐 page=1 / 无搜索的初始 state）。
const ROUTE_QUERY_KEYS: Record<string, { keys: unknown[][]; route: AnyRoute }> = {
  "/_app/dashboard": {
    keys: [
      ["dashboard", "stats"],
      ["user", "orders", 1],
    ],
    route: DashboardRoute,
  },
  "/_app/settings/apikeys": { keys: [["user", "apikeys"]], route: ApiKeysRoute },
  "/_app/settings/billing": {
    keys: [
      ["user", "subscription"],
      ["user", "plan"],
    ],
    route: BillingRoute,
  },
  "/_app/settings/credits": { keys: [["user", "credits"]], route: CreditsRoute },
  "/_app/settings/payments": { keys: [["user", "orders", 1]], route: PaymentsRoute },
  "/_app/settings/tickets": { keys: [["user", "tickets"]], route: TicketsRoute },
  "/_app/settings/sessions": { keys: [["auth", "sessions"]], route: SessionsRoute },
  "/_app/settings/accounts": { keys: [["auth", "accounts"]], route: AccountsRoute },
  "/admin": { keys: [["admin", "metrics"]], route: AdminIndexRoute },
  "/admin/users": { keys: [["admin", "users", 1, ""]], route: AdminUsersRoute },
  "/admin/roles": {
    keys: [
      ["admin", "roles"],
      ["admin", "permissions"],
    ],
    route: AdminRolesRoute,
  },
  "/admin/orders": { keys: [["admin", "orders", 1]], route: AdminOrdersRoute },
  "/admin/subscriptions": { keys: [["admin", "subscriptions", 1]], route: AdminSubscriptionsRoute },
  "/admin/credits": { keys: [["admin", "credits", 1]], route: AdminCreditsRoute },
  "/admin/settings": { keys: [["admin", "config"]], route: AdminSettingsRoute },
  "/admin/ai-models": { keys: [["admin", "ai-models", 1]], route: AdminAiModelsRoute },
};

// 全局 fetch 打桩：所有 RPC / better-auth 请求一律 500，loader 取数必然失败。
// 覆盖 @/lib/api 的 hc 单例与 better-auth 客户端（两者都走 fetch）。
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "boom" }), {
          headers: { "content-type": "application/json" },
          status: 500,
        }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const runLoader = async (route: AnyRoute, queryClient: QueryClient) => {
  const loader = route.options.loader;
  if (!loader) {
    throw new Error(`${route.fullPath}: missing loader — intent preloading fetches JS only`);
  }
  if (typeof loader === "function") {
    // loader 只依赖 context.queryClient；其余字段以 never 形状占位。
    await loader({
      abortController: new AbortController(),
      context: { queryClient },
      deps: undefined,
      location: {} as never,
      params: {},
      path: route.fullPath,
      preload: false,
      remountDeps: undefined,
    } as never);
  } else {
    // 对象形式（loader: { handler }），本仓库暂未使用；防御性覆盖。
    await loader.handler({ context: { queryClient }, params: {}, preload: false } as never);
  }
};

describe("route loaders (defaultPreload: intent)", () => {
  it.each(Object.entries(ROUTE_QUERY_KEYS))(
    "%s: loader swallows fetch errors and seeds the cache keys the page reads",
    async (_path, { keys, route }) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 60 * 1000 } },
      });
      // 取数 500 时 loader 必须正常 resolve（导航继续，错误由组件内联呈现）。
      await expect(runLoader(route, queryClient)).resolves.not.toThrow();
      // 预取后各 key 在缓存中留下 query 记录 —— 证明 loader 预取的正是这些 key。
      for (const key of keys) {
        expect(queryClient.getQueryCache().find({ queryKey: key })).toBeDefined();
      }
    },
  );
});
