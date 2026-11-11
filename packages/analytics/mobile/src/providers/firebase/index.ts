// Firebase (GA4) provider —— 包装 @react-native-firebase/analytics。
//
// 动态 import 是刻意的（optional peer，隔离未安装的 app）。RNFirebase
// 随模块加载自动启动、无显式 init，因此 init() 仅缓存引用、零副作用；
// 真正的运行时错误（缺 google-services.json / GoogleService-Info.plist）
// 在首次方法调用时抛出 —— provider 将其转为 failed 态：warn 一次后
// 后续调用静默 no-op，绝不向业务层抛错（fork 者没配 Firebase 但开着
// ga_mobile_enabled 时，应用其余功能不受影响）。
//
// 错误可观测：除了一次性 console.warn，失败还会交给调用方传入的 report
//（facade 会把上层配置的 onError/debug 传下来），便于接到 Sentry 或打开调试日志。
//
// GA 事件名约束：/^[A-Za-z0-9_]+$/ 且 ≤40 字符。违规事件名 sanitize
// 后照发（改名不丢弃），保证事件不静默消失。

import { ANALYTICS_EVENTS } from "@openstarter/analytics";
import { errorContext, sanitizeProperties } from "@openstarter/analytics/runtime";

import type { AnalyticsMethod, EventProperties, UserTraits } from "@openstarter/analytics";
import type { ReportError } from "@openstarter/analytics/runtime";

import type { MobileAnalyticsProvider } from "../../internal/types";

// GA 硬限制：事件名 ≤40 字符、仅字母数字下划线。
const GA_EVENT_NAME_MAX_LENGTH = 40;

/** GA 事件名 sanitize：非法字符替换为 `_`、超长截断（改名发，不丢弃）。 */
export function sanitizeGaEventName(name: string): string {
  const replaced = name.replace(/[^A-Za-z0-9_]/gu, "_");
  return replaced.slice(0, GA_EVENT_NAME_MAX_LENGTH);
}

/** warn 去重槽：模块级，同种错误只提示一次（整体置位，不就地修改逻辑无涉）。 */
let hasWarned = false;
function warnOnce(message: string): void {
  if (hasWarned) {
    return;
  }
  hasWarned = true;
  console.warn(`[analytics-mobile] ${message}`);
}

export async function createFirebaseProvider(report?: ReportError): Promise<MobileAnalyticsProvider> {
  /** 统一失败出口：上报给上层 + 一次性 warn，绝不向上抛。 */
  const fail = (method: AnalyticsMethod, error: unknown): void => {
    report?.(error, errorContext("firebase", method));
    warnOnce(
      `Firebase analytics unavailable (missing plist?), provider disabled: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  };

  try {
    const mod = await import("@react-native-firebase/analytics");
    // 模块化 API（v23+）：实例取值器是具名导出 getAnalytics(app?)，等同
    // 旧版 firebase.analytics()；v26 已无 default 导出。
    const { getAnalytics } = mod;

    return {
      async identify(_profileId: string, traits?: UserTraits): Promise<void> {
        try {
          // GA 无 identify 概念：traits 扁平化为 user properties（GA 限制值
          // 必须是字符串，非字符串值 stringify 后照发，不静默丢弃）。
          const properties = Object.fromEntries(
            Object.entries(traits ?? {}).map(([key, value]) => [
              key,
              typeof value === "string" || value === null ? value : String(value),
            ]),
          );
          await getAnalytics().setUserProperties(properties);
        } catch (error) {
          fail("identify", error);
        }
      },
      async init(): Promise<void> {
        // RNFirebase 自动启动；显式初始化不存在，保持零副作用。
      },
      name: "firebase",
      async reset(): Promise<void> {
        try {
          // GA 无 reset：清空 user id 与 user properties 即解除身份绑定。
          await getAnalytics().setUserId(null);
          await getAnalytics().setUserProperties({});
        } catch (error) {
          fail("reset", error);
        }
      },
      async setScreenName(name: string, params?: EventProperties): Promise<void> {
        try {
          // 映射为 screen_view 自定义事件而非 logScreenView：__DEV__ 下
          // logScreenView 按 superstruct ScreenView 结构校验（只认
          // screen_class/screen_name），附加 params 会抛错、事件被静默
          // 丢弃；logEvent 仅校验事件名与 params 的对象性，附加字段
          // 全平台透传。
          await getAnalytics().logEvent(ANALYTICS_EVENTS.SCREEN_VIEW, {
            screen_name: name,
            ...sanitizeProperties(params),
          });
        } catch (error) {
          fail("setScreenName", error);
        }
      },
      async setUserId(userId: string | null): Promise<void> {
        try {
          await getAnalytics().setUserId(userId);
        } catch (error) {
          fail("identify", error);
        }
      },
      async track(event: string, properties?: EventProperties): Promise<void> {
        try {
          await getAnalytics().logEvent(
            sanitizeGaEventName(event),
            sanitizeProperties(properties),
          );
        } catch (error) {
          fail("track", error);
        }
      },
    };
  } catch (error) {
    // 模块本身缺失（未装 optional peer）。
    report?.(error, errorContext("firebase", "init"));
    warnOnce(
      `Firebase analytics SDK unavailable, provider skipped: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      async identify(): Promise<void> {},
      async init(): Promise<void> {},
      name: "firebase",
      async reset(): Promise<void> {},
      async setScreenName(): Promise<void> {},
      async setUserId(): Promise<void> {},
      async track(): Promise<void> {},
    };
  }
}
