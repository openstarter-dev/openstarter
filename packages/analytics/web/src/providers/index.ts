// web 端供应商注册表 —— 目录约定：一个供应商一个目录
//    providers/<name>/scripts.ts   采集脚本模板（纯，无副作用）
//    providers/<name>/strategy.ts  运行时策略（读写脚本暴露的全局对象）
//    providers/<name>/index.ts     定义（组装上述两块 + 配置判定）
//
// 新增供应商只需新建一个目录并登记到下面的数组：脚本注入（../scripts.ts）与运行时策略
// （../strategy.ts）会自动同步，不会出现「注入了但不上报」或反之。
// 数组顺序即脚本注入顺序与事件转发顺序。
//
// noop / composite 两个策略不在这里：它们是跨平台通用的运行时工具，统一放在
// @openstarter/analytics/runtime，避免三个平台各写一份。

import { googleAnalyticsDefinition } from "./google-analytics";
import { plausibleDefinition } from "./plausible";

import type { WebAnalyticsProviderDefinition } from "../internal/types";

export { googleAnalyticsScripts } from "./google-analytics";
export { plausibleScripts } from "./plausible";

/**
 * 类型标注到契约而非 `as const`：各供应商的 `createStrategy` 可以不接收 config
 *（不依赖配置的实现没必要声明形参），标注为契约类型后调用方统一按 `(config)` 调用。
 */
export const WEB_ANALYTICS_PROVIDERS: readonly WebAnalyticsProviderDefinition[] = [
  googleAnalyticsDefinition,
  plausibleDefinition,
];
