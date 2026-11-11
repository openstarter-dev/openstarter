// 错误出口与安全执行 —— 把「上报永不抛错」从注释约定变成可复用的实现。
//
// 默认行为仍是静默（契约要求），但接上 `onError` 后可以把错误转发到 Sentry 等；
// `debug` 打开时额外打 console.warn，用于「为什么没数据」的现场排查。

import type {
  AnalyticsErrorContext,
  AnalyticsErrorHandler,
  AnalyticsStrategyName,
} from "../types";

export interface ErrorReporterOptions {
  /** 排障模式：错误一律 console.warn（生产默认关闭，避免污染控制台）。 */
  debug?: boolean;
  /** 自定义错误出口；即使 debug 关闭也会被调用。 */
  onError?: AnalyticsErrorHandler;
}

export type ReportError = (error: unknown, context: AnalyticsErrorContext) => void;

/** 创建一个错误出口：内部吞掉 onError 自身的异常，保证调用链不被打断。 */
export function createErrorReporter(options: ErrorReporterOptions = {}): ReportError {
  const { debug = false, onError } = options;

  return (error, context) => {
    if (onError) {
      try {
        onError(error, context);
      } catch {
        // 错误出口自身失败不得上抛
      }
    }

    if (debug) {
      console.warn(`[analytics] ${context.provider}.${context.method} failed`, error);
    }
  };
}

/**
 * 安全执行一次上报：失败时交给 reporter 并返回 undefined。
 * 所有 facade 的便捷函数与 composite 转发都经由它，避免每处重复写 try/catch。
 */
export async function runSafely<T>(
  action: () => Promise<T> | T,
  report: ReportError,
  context: AnalyticsErrorContext,
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    report(error, context);
    return undefined;
  }
}

/** 便捷构造：策略名 + 方法名 → 上下文。 */
export function errorContext(
  provider: AnalyticsStrategyName,
  method: AnalyticsErrorContext["method"],
): AnalyticsErrorContext {
  return { method, provider };
}
