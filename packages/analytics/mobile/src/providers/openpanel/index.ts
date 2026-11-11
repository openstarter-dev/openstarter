// OpenPanel provider —— 包装官方 @openpanel/react-native SDK。
//
// 动态 import 是刻意的：SDK 声明为 optional peer，未安装该依赖的 app
// 在这里被隔离（import 抛错 → failed 态 provider），门面据此跳过本
// provider，其余分析通道不受影响。
//
// 官方签名适配（消费方只见契约的 AnalyticsProvider 接口）：
//   - identify: { profileId, firstName/lastName/email... } 顶层字段官方直收，
//     其余 traits 归入 properties —— 拆分归一在本层完成。
//   - setUserId: OpenPanel 无独立概念，映射为 setGlobalProperties({ userId })。
//   - setScreenName: 官方无屏幕事件，映射为 track("screen_view", {...})。
//
// 错误可观测：每次失败都交给 report（facade 传入的 onError/debug），同时保留
// 一次性的 console.warn（避免没有接错误出口时完全静默）。

import { ANALYTICS_EVENTS } from "@openstarter/analytics";
import { errorContext, sanitizeProperties } from "@openstarter/analytics/runtime";

import type { AnalyticsMethod, EventProperties, UserTraits } from "@openstarter/analytics";
import type { ReportError } from "@openstarter/analytics/runtime";

import type { MobileAnalyticsProvider } from "../../internal/types";

// 官方 identify 直收的顶层画像字段；其余 traits 一律进 properties。
const TOP_LEVEL_TRAIT_KEYS = ["email", "firstName", "lastName"] as const;

interface OpenPanelOptions {
  clientId: string;
  clientSecret: string;
}

/** 拆分 traits：顶层字段直传官方，其余进 properties（不可变，返回新对象）。 */
function splitTraits(traits: UserTraits | undefined): {
  properties: EventProperties;
  topLevel: EventProperties;
} {
  const topLevel: EventProperties = {};
  const properties: EventProperties = {};
  if (traits) {
    for (const [key, value] of Object.entries(traits)) {
      if ((TOP_LEVEL_TRAIT_KEYS as readonly string[]).includes(key)) {
        topLevel[key] = value;
      } else {
        properties[key] = value;
      }
    }
  }
  return { properties, topLevel };
}

/** warn 去重槽：同种错误只提示一次。 */
let hasWarned = false;
function warnOnce(message: string): void {
  if (hasWarned) {
    return;
  }
  hasWarned = true;
  console.warn(`[analytics-mobile] ${message}`);
}

export async function createOpenPanelProvider(
  options: OpenPanelOptions,
  report?: ReportError,
): Promise<MobileAnalyticsProvider> {
  const fail = (method: AnalyticsMethod, error: unknown): void => {
    report?.(error, errorContext("openpanel", method));
    warnOnce(
      `OpenPanel SDK call failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  };

  // 动态 import 失败（未安装 optional peer）→ failed 态 provider。
  try {
    const { OpenPanel } = await import("@openpanel/react-native");
    const instance = new OpenPanel({
      clientId: options.clientId,
      clientSecret: options.clientSecret,
    });

    return {
      async identify(profileId: string, traits?: UserTraits): Promise<void> {
        try {
          const { properties, topLevel } = splitTraits(traits);
          await instance.identify({ profileId, ...topLevel, properties });
        } catch (error) {
          fail("identify", error);
        }
      },
      async init(): Promise<void> {
        // 官方 RN SDK 构造即完成初始化配置；init 无额外动作。
      },
      name: "openpanel",
      async reset(): Promise<void> {
        try {
          // OpenPanel RN 无独立 reset：身份来自全局属性，置 null 即解除绑定。
          await instance.setGlobalProperties({ userId: null });
        } catch (error) {
          fail("reset", error);
        }
      },
      async setScreenName(name: string, params?: EventProperties): Promise<void> {
        try {
          await instance.track(ANALYTICS_EVENTS.SCREEN_VIEW, {
            screen_name: name,
            ...sanitizeProperties(params),
          });
        } catch (error) {
          fail("setScreenName", error);
        }
      },
      async setUserId(userId: string | null): Promise<void> {
        try {
          await instance.setGlobalProperties({ userId });
        } catch (error) {
          fail("identify", error);
        }
      },
      async track(event: string, properties?: EventProperties): Promise<void> {
        try {
          await instance.track(event, sanitizeProperties(properties));
        } catch (error) {
          fail("track", error);
        }
      },
    };
  } catch (error) {
    report?.(error, errorContext("openpanel", "init"));
    warnOnce(
      `OpenPanel SDK unavailable, provider skipped: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    // failed 态：接口契约的 no-op 实现，永不抛错。
    return {
      async identify(): Promise<void> {},
      async init(): Promise<void> {},
      name: "openpanel",
      async reset(): Promise<void> {},
      async setScreenName(): Promise<void> {},
      async setUserId(): Promise<void> {},
      async track(): Promise<void> {},
    };
  }
}
