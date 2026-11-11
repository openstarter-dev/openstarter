// Firebase (GA4) provider —— 包装 @react-native-firebase/analytics。
//
// 动态 import 是刻意的（optional peer，隔离未安装的 app）。RNFirebase
// 随模块加载自动启动、无显式 init，因此 init() 仅缓存引用、零副作用；
// 真正的运行时错误（缺 google-services.json / GoogleService-Info.plist）
// 在首次方法调用时抛出 —— provider 将其转为 failed 态：warn 一次后
// 后续调用静默 no-op，绝不向业务层抛错（fork 者没配 Firebase 但开着
// ga_mobile_enabled 时，应用其余功能不受影响）。
//
// GA 事件名约束：/^[A-Za-z0-9_]+$/ 且 ≤40 字符。违规事件名 sanitize
// 后照发（改名不丢弃），保证事件不静默消失。

import type { AnalyticsProvider, EventProperties, UserTraits } from "./types";

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

export async function createFirebaseProvider(): Promise<AnalyticsProvider> {
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
          warnOnce(
            `Firebase analytics unavailable (missing plist?), provider disabled: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
      async init(): Promise<void> {
        // RNFirebase 自动启动；显式初始化不存在，保持零副作用。
      },
      name: "firebase",
      async setScreenName(name: string, params?: EventProperties): Promise<void> {
        try {
          // 映射为 screen_view 自定义事件而非 logScreenView：__DEV__ 下
          // logScreenView 按 superstruct ScreenView 结构校验（只认
          // screen_class/screen_name），附加 params 会抛错、事件被静默
          // 丢弃；logEvent 仅校验事件名与 params 的对象性，附加字段
          // 全平台透传。
          await getAnalytics().logEvent("screen_view", {
            screen_name: name,
            ...params,
          });
        } catch (error) {
          warnOnce(
            `Firebase analytics unavailable (missing plist?), provider disabled: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
      async setUserId(userId: string | null): Promise<void> {
        try {
          await getAnalytics().setUserId(userId);
        } catch (error) {
          warnOnce(
            `Firebase analytics unavailable (missing plist?), provider disabled: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
      async track(event: string, properties?: EventProperties): Promise<void> {
        try {
          await getAnalytics().logEvent(sanitizeGaEventName(event), properties);
        } catch (error) {
          warnOnce(
            `Firebase analytics unavailable (missing plist?), provider disabled: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
    };
  } catch (error) {
    // 模块本身缺失（未装 optional peer）。
    warnOnce(
      `Firebase analytics SDK unavailable, provider skipped: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      async identify(): Promise<void> {},
      async init(): Promise<void> {},
      name: "firebase",
      async setScreenName(): Promise<void> {},
      async setUserId(): Promise<void> {},
      async track(): Promise<void> {},
    };
  }
}
