// @openstarter/analytics/runtime —— 跨平台通用的运行时工具（零平台依赖）。
//
// 这里的东西三端完全一样：错误出口、属性裁剪、noop / composite 两个策略。
// 放在单独子入口而不是主入口，是为了让只用类型的消费方（如 server 端）不被运行时拖累。

export { createCompositeProvider } from "./composite";
export { createErrorReporter, errorContext, runSafely } from "./errors";
export type { ErrorReporterOptions, ReportError } from "./errors";
export { createNoopProvider } from "./noop";
export { sanitizeProperties } from "./sanitize";
