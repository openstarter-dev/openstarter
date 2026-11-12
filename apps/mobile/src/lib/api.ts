import type { AppType } from "@openstarter/api";
import { hc } from "hono/client";

import { getSessionCookie } from "./auth-client";
import { getEnv } from "./env";

const env = getEnv();

export const apiClient = hc<AppType>(env.ok ? env.apiUrl : "http://127.0.0.1", {
  headers: () => ({ cookie: getSessionCookie() }),
});
