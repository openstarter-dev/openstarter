// apps/mobile/src/lib/analytics.ts —— 分析能力薄壳。
//
// 真正的门面在 @openstarter/analytics-mobile（initAnalytics 选择
// OpenPanel / Firebase / noop），本文件只做两件 app 侧的事：
//   1. 把构建期 env（process.env）交给包内解析器归一并初始化门面；
//      供应商开关随构建固化，不再经 /api/analytics/config 由 web 管理端控制。
//   2. 提供 useScreenTracking hook（expo-router 路径 → 屏幕事件）。
// 上报错误全部由门面消化；这里不再包一层 try/catch（解析层永不抛错）。

import {
  configureAnalyticsErrors,
  initAnalytics,
  resolveMobileAnalyticsConfig as resolveConfig,
  setScreenName,
} from "@openstarter/analytics-mobile";
import { usePathname } from "expo-router";
import { useEffect } from "react";

// 开发期把上报失败打到控制台（生产保持静默；接入监控时改传 onError）。
// 用 globalThis 读取 __DEV__：该常量由 RN/Metro 注入，Node（测试）里不存在，
// 直接引用未声明全局会在测试环境抛 ReferenceError。
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
