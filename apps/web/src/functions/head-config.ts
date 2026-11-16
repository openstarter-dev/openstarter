// Server function providing public head-script configuration for SSR and client hydration.
// 服务端函数：读取客服组件公开配置，供根路由 SSR 与客户端水合注入头部脚本。

import { createServerFn } from "@tanstack/react-start";

import { getWebConfig, type WebHeadConfig } from "@/config";

export const getWebHeadConfigFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<WebHeadConfig> => {
    const { support } = getWebConfig();
    return { support };
  },
);