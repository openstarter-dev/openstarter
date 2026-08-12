import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createExtensionApiClient } from "../../lib/api";
import { createExtensionAuthClient } from "../../lib/auth-client";
import { getAppUrl } from "../../lib/env";
import { chromeCookieReader } from "../../lib/session";
import { AppProviders } from "../../providers/providers";
import { Layout } from "../../components/layout";
import { Main } from "../../components/main";
import "../../styles/globals.css";

const env = getAppUrl();
const cookieReader = chromeCookieReader();

const api = env.ok
  ? createExtensionApiClient(env.origin, cookieReader)
  : ({} as ReturnType<typeof createExtensionApiClient>);
const auth = env.ok
  ? createExtensionAuthClient(env.origin, cookieReader)
  : ({} as ReturnType<typeof createExtensionAuthClient>);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders value={{ api, auth }}>
      <Layout>
        <Main />
      </Layout>
    </AppProviders>
  </StrictMode>
);