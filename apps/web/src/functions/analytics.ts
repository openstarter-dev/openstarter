import type { AnalyticsConfig } from "@openstarter/analytics-web";
import { createAnalyticsConfigLoader } from "@openstarter/analytics-web/server";
import { createServerFn } from "@tanstack/react-start";

const loadAnalyticsConfig = createAnalyticsConfigLoader();

export const getAnalyticsConfigFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AnalyticsConfig> => loadAnalyticsConfig(),
);
