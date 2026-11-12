import type { AppType } from "@openstarter/api";
import { hc } from "hono/client";
import { createTaroFetch } from "./taro-fetch";
import { useAuthStore } from "@/stores/auth-store";
import { removeToken } from "@/utils/storage";
import Taro from "@tarojs/taro";
import { getApiBaseUrl } from "@/lib/env";

function handleUnauthorized() {
  removeToken();
  useAuthStore.getState().logout();
  Taro.reLaunch({ url: "/pages/login/index" });
}

export function createClient() {
  return hc<AppType>(getApiBaseUrl(), {
    fetch: createTaroFetch(handleUnauthorized),
  });
}
