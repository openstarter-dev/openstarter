import {
  configureAnalyticsErrors,
  initAnalytics,
  resolveMobileAnalyticsConfig as resolveConfig,
  setScreenName,
} from "@openstarter/analytics-mobile";
import { usePathname } from "expo-router";
import { useEffect } from "react";

const isDevBuild = (globalThis as { __DEV__?: boolean }).__DEV__ === true;
if (isDevBuild) {
  configureAnalyticsErrors({ debug: true });
}

/** 供测试注入的构建期 env 原始形态（process.env 的快照语义）。 */
function readAnalyticsEnv(): Record<string, string | undefined> {
  return process.env;
}

/** 按构建期 env 初始化门面（幂等由门面保证）；env 缺失等价于未配置（noop）。 */
export async function initAnalyticsFromEnv(): Promise<void> {
  await initAnalytics(resolveConfig(readAnalyticsEnv()));
}

/** 路径变化时上报屏幕事件（tabs / auth 两个 layout 各接一行）。 */
export function useScreenTracking(): void {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      void setScreenName(pathname);
    }
  }, [pathname]);
}
