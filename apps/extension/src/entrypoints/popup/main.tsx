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
