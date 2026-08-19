// apps/mini-app/src/lib/auth-client.ts
// Better-auth 客户端实例（Taro 配置）

import { createAuthClient } from "@openstarter/auth/client/taro";
import { createTaroFetch } from "@/services/taro-fetch";
import { getToken } from "@/utils/storage";
import { getApiBaseUrl } from "./env";

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  fetchOptions: {
    customFetchImpl: createTaroFetch(),
    auth: {
      type: "Bearer",
      token: () => getToken() || "",
    },
  },
});
