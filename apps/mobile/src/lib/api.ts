import { createApiClient } from "@openstarter/api/client";

import { getSessionCookie } from "./auth-client";
import { getEnv } from "./env";

const env = getEnv();

export const apiClient = createApiClient({
  baseUrl: env.ok ? env.apiUrl : "http://127.0.0.1",
  // hono 的 headers 回调支持异步：1.7 的 getCookie() 是 Promise，必须 await。
  headers: async () => ({ cookie: await getSessionCookie() }),
});
