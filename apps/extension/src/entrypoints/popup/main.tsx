// apps/extension/src/entrypoints/popup/main.tsx —— 真实依赖装配（chrome.cookies、
// 真实网络请求、authClient.getSession()），是唯一接触浏览器全局的地方。
// App 本身在 app.test.tsx 里已用 TanStack Query 测试过，这里不重复测状态机逻辑，
// 只是把真实实现接上。
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";

import { createExtensionApiClient } from "../../lib/api";
import { createExtensionAuthClient } from "../../lib/auth-client";
import { getAppUrl } from "../../lib/env";
import { chromeCookieReader } from "../../lib/session";
import { AppProviders } from "../../providers/providers";
import type { AppDeps } from "./app";
import { App } from "./app";
import "../../styles/globals.css";

const env = getAppUrl();
const cookieReader = chromeCookieReader();

function buildDeps(): AppDeps {
  if (!env.ok) {
    return {
      env,
      onManage: () => undefined,
      onSignIn: () => undefined,
      onSignOut: () => undefined,
    };
  }

  const authClient = createExtensionAuthClient(env.origin, cookieReader);

  const openWebPage = (path: string) => {
    browser.tabs.create({ url: `${env.appUrl}${path}` });
  };

  return {
    env,
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

const deps = buildDeps();
// Always create API and auth clients for the providers chain, even when env is
// misconfigured — the App will short-circuit to the misconfigured view before
// calling any hooks, so the stubs are never used for actual requests.
const api = env.ok
  ? createExtensionApiClient(env.origin, cookieReader)
  : ({} as ReturnType<typeof createExtensionApiClient>);
const auth = env.ok
  ? createExtensionAuthClient(env.origin, cookieReader)
  : ({} as ReturnType<typeof createExtensionAuthClient>);

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders value={{ api, auth }}>
      <App deps={deps} />
    </AppProviders>
  </StrictMode>,
);
