// OpenPanel provider —— 包装官方 @openpanel/react-native SDK。
//
// 动态 import 是刻意的：SDK 声明为 optional peer，未安装该依赖的 app
// 在这里被隔离（import 抛错 → failed 态 provider），门面据此跳过本
// provider，其余分析通道不受影响。
//
// 官方签名适配（消费方只见本包的 AnalyticsProvider 接口）：
//   - identify: { profileId, firstName/lastName/email... } 顶层字段官方直收，
//     其余 traits 归入 properties —— 拆分归一在本层完成。
//   - setUserId: OpenPanel 无独立概念，映射为 setGlobalProperties({ userId })。
//   - setScreenName: 官方无屏幕事件，映射为 track("screen_view", {...})。

import type { AnalyticsProvider, EventProperties, UserTraits } from "./types";

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
): Promise<AnalyticsProvider> {
  // 动态 import 失败（未安装 optional peer）→ failed 态 provider。
  try {
    const { OpenPanel } = await import("@openpanel/react-native");
    const instance = new OpenPanel({
      clientId: options.clientId,
      clientSecret: options.clientSecret,
    });

    return {
      async identify(profileId: string, traits?: UserTraits): Promise<void> {
        const { properties, topLevel } = splitTraits(traits);
        await instance.identify({ profileId, ...topLevel, properties });
      },
      async init(): Promise<void> {
        // 官方 RN SDK 构造即完成初始化配置；init 无额外动作。
      },
      name: "openpanel",
      async setScreenName(name: string, params?: EventProperties): Promise<void> {
        await instance.track("screen_view", { screen_name: name, ...params });
      },
      async setUserId(userId: string | null): Promise<void> {
        await instance.setGlobalProperties({ userId });
      },
      async track(event: string, properties?: EventProperties): Promise<void> {
        await instance.track(event, properties);
      },
    };
  } catch (error) {
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
      async setScreenName(): Promise<void> {},
      async setUserId(): Promise<void> {},
      async track(): Promise<void> {},
    };
  }
}
