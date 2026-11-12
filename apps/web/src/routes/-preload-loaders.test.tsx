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
import { Route as AdminSettingsRoute } from "./admin/settings";
import { Route as AdminSubscriptionsRoute } from "./admin/subscriptions";
import { Route as AdminUsersRoute } from "./admin/users";

/** `deps` 与真实 loaderDeps 一致（分页页由 search 校验给出 page，缺省 1）。 */
const ROUTE_QUERY_KEYS: Record<
  string,
  { deps?: Record<string, unknown>; keys: unknown[][]; route: AnyRoute }
> = {
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
  "/_app/settings/payments": {
    deps: { page: 1 },
    keys: [["user", "orders", 1]],
    route: PaymentsRoute,
  },
  "/_app/settings/tickets": { keys: [["user", "tickets"]], route: TicketsRoute },
  "/_app/settings/sessions": { keys: [["auth", "sessions"]], route: SessionsRoute },
  "/_app/settings/accounts": { keys: [["auth", "accounts"]], route: AccountsRoute },
  "/admin": { keys: [["admin", "metrics"]], route: AdminIndexRoute },
  "/admin/users": {
    deps: { page: 1, q: "" },
    keys: [["admin", "users", 1, ""]],
    route: AdminUsersRoute,
  },
  "/admin/orders": { deps: { page: 1 }, keys: [["admin", "orders", 1]], route: AdminOrdersRoute },
  "/admin/subscriptions": {
    deps: { page: 1 },
    keys: [["admin", "subscriptions", 1]],
    route: AdminSubscriptionsRoute,
  },
  "/admin/credits": {
    deps: { page: 1 },
    keys: [["admin", "credits", 1]],
    route: AdminCreditsRoute,
  },
  "/admin/settings": { keys: [["admin", "config"]], route: AdminSettingsRoute },
  "/admin/ai-models": {
    deps: { page: 1 },
    keys: [["admin", "ai-models", 1]],
    route: AdminAiModelsRoute,
  },
};

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

const runLoader = async (
  route: AnyRoute,
  queryClient: QueryClient,
  deps?: Record<string, unknown>,
) => {
  const loader = route.options.loader;
  if (!loader) {
    throw new Error(`${route.fullPath}: missing loader — intent preloading fetches JS only`);
  }
  if (typeof loader === "function") {
    await loader({
      abortController: new AbortController(),
      context: { queryClient },
      deps,
      location: {} as never,
      params: {},
      path: route.fullPath,
      preload: false,
      remountDeps: undefined,
    } as never);
  } else {
    await loader.handler({ context: { queryClient }, params: {}, preload: false } as never);
  }
};

describe("route loaders (defaultPreload: intent)", () => {
  it.each(Object.entries(ROUTE_QUERY_KEYS))(
    "%s: loader swallows fetch errors and seeds the cache keys the page reads",
    async (_path, { deps, keys, route }) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 60 * 1000 } },
      });
      await expect(runLoader(route, queryClient, deps)).resolves.not.toThrow();
      for (const key of keys) {
        expect(queryClient.getQueryCache().find({ queryKey: key })).toBeDefined();
      }
    },
  );
});
