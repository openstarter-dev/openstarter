// apps/extension/src/entrypoints/popup/main.tsx —— 真实依赖装配（chrome.cookies、
// 真实网络请求、authClient.getSession()），是唯一接触浏览器全局的地方。App 本身在
// app.test.tsx 里已用注入的 fake 依赖测过，这里不重复测状态机逻辑，只是把真实实现接上。
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";

import { createExtensionApiClient } from "../../lib/api";
import { createExtensionAuthClient } from "../../lib/auth-client";
import { getAppUrl } from "../../lib/env";
import { chromeCookieReader } from "../../lib/session";
import type {
  EndpointResult,
  SubscriptionStatusView,
  UserPlan,
} from "../../lib/state";
import type { AppDeps } from "./app";
import { App } from "./app";
import "../../styles/globals.css";

const env = getAppUrl();
const cookieReader = chromeCookieReader();

// 平铺 try/catch 读取 JSON，避免 Ultracite noNestedPromises 对 `.catch()` 嵌套的报错。
async function readJsonOr(response: Response, fallback: null) {
  try {
    return await response.json();
  } catch {
    return fallback;
  }
}

function endpointResult<T>(
  promise: Promise<Response>,
  extract: (json: unknown) => T
): Promise<EndpointResult<T>> {
  return promise
    .then(async (response) => {
      if (response.ok) {
        const json = await response.json();
        return { data: extract(json), status: "success" as const };
      }
      const json = await readJsonOr(response, null);
      const message =
        json && typeof json === "object" && "message" in json
          ? String((json as { message: unknown }).message)
          : null;
      return {
        httpStatus: response.status,
        message,
        status: "http-error" as const,
      };
    })
    .catch(() => ({ status: "network-error" as const }));
}

function buildDeps(): AppDeps {
  if (!env.ok) {
    return {
      env,
      fetchCredits: () =>
        Promise.resolve({ status: "network-error" }) as Promise<
          EndpointResult<number>
        >,
      fetchPlan: () =>
        Promise.resolve({ status: "network-error" }) as Promise<
          EndpointResult<UserPlan>
        >,
      fetchSubscription: () =>
        Promise.resolve({
          status: "network-error",
        }) as Promise<EndpointResult<SubscriptionStatusView>>,
      fetchUser: () => Promise.resolve(null),
      onManage: () => undefined,
      onSignIn: () => undefined,
      onSignOut: () => undefined,
    };
  }

  const client = createExtensionApiClient(env.origin, cookieReader);
  const authClient = createExtensionAuthClient(env.origin, cookieReader);

  const openWebPage = (path: string) => {
    browser.tabs.create({ url: `${env.appUrl}${path}` });
  };

  return {
    env,
    fetchCredits: () =>
      endpointResult(
        client.api.user.credits.$get({ query: {} }),
        (json) => (json as { data: { balance: number } }).data.balance
      ),
    fetchPlan: () =>
      endpointResult(
        client.api.user.plan.$get(),
        (json) => (json as { data: { plan: UserPlan } }).data.plan
      ),
    fetchSubscription: () =>
      endpointResult(
        client.api.user.subscription.$get(),
        (json) => (json as { data: SubscriptionStatusView }).data
      ),
    fetchUser: () =>
      authClient
        .getSession()
        .then(({ data }) =>
          data?.user ? { email: data.user.email, name: data.user.name } : null
        )
        .catch(() => null),
    onManage: () => openWebPage("/settings/profile"),
    onSignIn: () => openWebPage("/login"),
    onSignOut: () => {
      authClient.signOut().finally(() => {
        openWebPage("/login");
      });
    },
  };
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Popup root element (#root) is missing from index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App deps={buildDeps()} />
  </StrictMode>
);
