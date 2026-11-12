// 分析配置 SSR 加载（R25.1 / R25.2）。
//
// 框架绑定留在 app 层：packages/analytics-web 只提供框架无关的读取器（类型化 RPC + TTL 缓存），
// 这里用 createServerFn 包成服务端函数——平台包因此不反向依赖 @tanstack/react-start。
//
// 读取语义见包的 ./server 入口：失败或无数据回退为空配置（不注入任何脚本），读取失败不写缓存。

import type { AnalyticsConfig } from "@openstarter/analytics-web";
import { createAnalyticsConfigLoader } from "@openstarter/analytics-web/server";
import { createServerFn } from "@tanstack/react-start";

// 进程内单例：缓存 30s，管理员改配置后最多 30s 生效（重复创建会各自持有独立空缓存）。
const loadAnalyticsConfig = createAnalyticsConfigLoader();

/** 读取公开分析配置（SSR），供根路由 head() 依据其条件注入采集脚本（R25.1/R25.2）。 */
export const getAnalyticsConfigFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AnalyticsConfig> => loadAnalyticsConfig(),
);
