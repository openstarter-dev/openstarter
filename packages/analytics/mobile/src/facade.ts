// 门面 —— initAnalytics 按配置组装 provider，便捷函数转发事件。
//
// 语义（spec §4）：
//   - 未配置 → noop；单开 → 单 provider；双开 → composite（事件双写）。
//   - provider 工厂抛错 → warn 一次后跳过该 provider，不影响其余。
//   - init 幂等：模块级缓存槽整体替换（不就地修改），二次调用直返。
//   - 预 init 调用便捷函数是安全 no-op（移动端启动流程 init 必然先行，
//     不引入队列复杂度）。
//   - 所有转发经 shared runtime 的 runSafely：上报永不向业务层抛错。
//
// 错误可观测：默认静默，但 `configureAnalyticsErrors({ onError, debug })` 可把错误
// 接到 Sentry 或打开调试日志；provider 内部的降级（SDK 缺失/缺 plist）也会走同一出口。
//
// provider 统一实现 @openstarter/analytics 的跨平台契约（AnalyticsProvider），
// 移动端在此之上多 setUserId（见 ./internal/types.ts）。

import { createCompositeProvider, createErrorReporter, errorContext, runSafely } from "@openstarter/analytics/runtime";

import { createFirebaseProvider } from "./providers/firebase";
import { createNoopProvider } from "./providers/noop";
import { createOpenPanelProvider } from "./providers/openpanel";

import type { AnalyticsMethod, EventProperties, UserTraits } from "@openstarter/analytics";
import type { ErrorReporterOptions, ReportError } from "@openstarter/analytics/runtime";

import type { MobileAnalyticsConfig } from "./config";
import type { MobileAnalyticsProvider } from "./internal/types";

// 模块级缓存槽（单例；仅整体替换，不就地修改——对齐 analytics-web 的 configCache 模式）。
let activeProvider: MobileAnalyticsProvider | undefined;

// 错误出口：默认静默（契约要求），可由 configureAnalyticsErrors 替换。
let report: ReportError = createErrorReporter();

/** 配置错误出口（onError 接 Sentry / debug 打开 console.warn）；应在 initAnalytics 之前调用。 */
export function configureAnalyticsErrors(options: ErrorReporterOptions): void {
  report = createErrorReporter(options);
}

/** composite provider：契约方法复用 shared 实现，只补移动端必需项（init / setUserId）。 */
function compositeProvider(providers: MobileAnalyticsProvider[]): MobileAnalyticsProvider {
  return {
    ...createCompositeProvider(providers),
    // 移动端把 init 收窄为必需，这里显式转发（shared composite 的 init 在类型上是可选的）
    async init(): Promise<void> {
      for (const provider of providers) {
        await provider.init();
      }
    },
    async setUserId(userId: string | null): Promise<void> {
      for (const provider of providers) {
        await provider.setUserId(userId);
      }
    },
  };
}

/** warn 去重：门面层每个工厂失败只提示一次。 */
const warnedFactories = new Set<string>();
function warnFactoryOnce(key: string, error: unknown): void {
  if (warnedFactories.has(key)) {
    return;
  }
  warnedFactories.add(key);
  console.warn(
    `[analytics-mobile] ${key} provider init failed, skipped: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

/**
 * 按配置初始化并返回生效 provider（幂等）。
 * OP：clientId 与 clientSecret 都非空才启用（半配置视为未配置）。
 * GA：gaMobileEnabled 才实例化（firebase 构建文件缺失由 provider 内部降级）。
 * 配置来源为构建期 env（见 config.ts）—— 供应商开关随构建固化，不再由
 * web 管理端经 /api/analytics/config 控制。
 */
export async function initAnalytics(
  config: MobileAnalyticsConfig,
): Promise<MobileAnalyticsProvider> {
  if (activeProvider) {
    return activeProvider;
  }

  const providers: MobileAnalyticsProvider[] = [];

  if (config.openpanelClientId && config.openpanelClientSecret) {
    try {
      providers.push(
        await createOpenPanelProvider(
          {
            clientId: config.openpanelClientId,
            clientSecret: config.openpanelClientSecret,
          },
          report,
        ),
      );
    } catch (error) {
      warnFactoryOnce("openpanel", error);
      report(error, errorContext("openpanel", "init"));
    }
  }

  if (config.gaMobileEnabled) {
    try {
      providers.push(await createFirebaseProvider(report));
    } catch (error) {
      warnFactoryOnce("firebase", error);
      report(error, errorContext("firebase", "init"));
    }
  }

  // 解构而非下标取值：noUncheckedIndexedAccess 下 providers[0] 带宽泛 undefined，
  // 解构 + 显式判断可让 TS 精确收窄（等效于 brief 的三段 ternary）。
  const [firstProvider] = providers;
  const provider =
    firstProvider === undefined
      ? createNoopProvider()
      : providers.length === 1
        ? firstProvider
        : compositeProvider(providers);

  activeProvider = provider;

  const providerName = provider.name;
  await runSafely(async () => provider.init?.(), report, errorContext(providerName, "init"));

  return provider;
}

/** 仅测试用：清空模块级缓存槽与 warn 去重集合。 */
export function resetAnalyticsForTests(): void {
  activeProvider = undefined;
  warnedFactories.clear();
}

/** 统一转发：未 init 时安全 no-op，失败交给错误出口。 */
async function forward(
  method: AnalyticsMethod,
  action: (provider: MobileAnalyticsProvider) => Promise<void>,
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

export async function setUserId(userId: string | null): Promise<void> {
  await forward("identify", (provider) => provider.setUserId(userId));
}

export async function setScreenName(name: string, params?: EventProperties): Promise<void> {
  await forward("setScreenName", (provider) => provider.setScreenName(name, params));
}
