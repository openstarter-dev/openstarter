import { hcWithType } from "@openstarter/api/client";

import { getSessionCookie } from "./auth-client";
import { getEnv } from "./env";

const env = getEnv();

export const apiClient = hcWithType(env.ok ? env.apiUrl : "http://127.0.0.1", {
  headers: () => ({ cookie: getSessionCookie() }),
});
