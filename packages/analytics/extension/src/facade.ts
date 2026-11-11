// 门面 —— initAnalytics 按配置选择 provider，便捷函数转发事件。
//
// 与 mobile 门面的语义保持一致（同一套契约、同一套「永不抛错」约定）：
//   - 未配置 / 配置不合规 → noop；
//   - init 幂等：模块级缓存槽整体替换，二次调用直返；
//   - 预 init 调用便捷函数是安全 no-op（扩展各入口自行决定何时 init）；
//   - 所有转发经 shared runtime 的 runSafely：上报永不向业务层抛错。
//
// 错误可观测：默认静默，`configureAnalyticsErrors({ onError, debug })` 可把错误接到
// Sentry 或打开调试日志（扩展最典型的故障是域名/host 配错，过去完全无痕）。
//
// 与 mobile 的差异：扩展端无动态 import（无可选 SDK），init 因此是同步的。

import { createErrorReporter, errorContext, runSafely } from "@openstarter/analytics/runtime";

import { createNoopProvider, EXTENSION_ANALYTICS_PROVIDERS } from "./providers";

import type { AnalyticsMethod, AnalyticsProvider, EventProperties, UserTraits } from "@openstarter/analytics";
import type { ErrorReporterOptions, ReportError } from "@openstarter/analytics/runtime";

import type { ExtensionAnalyticsConfig, ExtensionAnalyticsPorts } from "./internal/types";

// 模块级缓存槽（单例；仅整体替换，不就地修改——与 web/mobile 的缓存槽模式一致）。
let activeProvider: AnalyticsProvider | undefined;

// 错误出口：默认静默（契约要求），可由 configureAnalyticsErrors 替换。
let report: ReportError = createErrorReporter();

/** 配置错误出口（onError 接 Sentry / debug 打开 console.warn）；应在 initAnalytics 之前调用。 */
export function configureAnalyticsErrors(options: ErrorReporterOptions): void {
  report = createErrorReporter(options);
}

/** 按配置初始化并返回生效 provider（幂等）。 */
export function initAnalytics(
  config: ExtensionAnalyticsConfig,
  ports: ExtensionAnalyticsPorts = {},
): AnalyticsProvider {
  if (activeProvider) {
    return activeProvider;
  }

  const [definition] = EXTENSION_ANALYTICS_PROVIDERS.filter((provider) =>
    provider.isConfigured(config),
  );

  const provider =
    definition === undefined
      ? createNoopProvider()
      : definition.createStrategy(config, ports, report);

  activeProvider = provider;

  // init 在契约里是可选的；当前供应商都不实现，未来的 SDK 型供应商可在此异步启动。
  void provider.init?.();

  return provider;
}

/** 仅测试用：清空模块级缓存槽。 */
export function resetAnalyticsForTests(): void {
  activeProvider = undefined;
}

/** 统一转发：未 init 时安全 no-op，失败交给错误出口。 */
async function forward(
  method: AnalyticsMethod,
  action: (provider: AnalyticsProvider) => Promise<void>,
): Promise<void> {
  const provider = activeProvider;

  if (!provider) {
    return;
  }

  await runSafely(() => action(provider), report, errorContext(provider.name, method));
}

// —— 便捷转发（预 init 是安全 no-op） ——

export async function track(event: string, properties?: EventProperties): Promise<void> {
  await forward("track", (provider) => provider.track(event, properties));
}

export async function identify(profileId: string, traits?: UserTraits): Promise<void> {
  await forward("identify", (provider) => provider.identify(profileId, traits));
}

export async function reset(): Promise<void> {
  await forward("reset", (provider) => provider.reset());
}

export async function setScreenName(name: string, params?: EventProperties): Promise<void> {
  await forward("setScreenName", (provider) => provider.setScreenName(name, params));
}
