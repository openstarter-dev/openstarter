import type { AnalyticsConfig } from "@openstarter/analytics-web";
import { createAnalyticsConfigLoader } from "@openstarter/analytics-web/server";
import { createServerFn } from "@tanstack/react-start";

const loadAnalyticsConfig = createAnalyticsConfigLoader();

/** 读取公开分析配置（SSR），供根路由 head() 依据其条件注入采集脚本。 */
export const getAnalyticsConfigFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AnalyticsConfig> => loadAnalyticsConfig(),
);
