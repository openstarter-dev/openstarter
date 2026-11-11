// Google Analytics —— 运行时策略（读取脚本注入后暴露的 window.gtag）。
//
// 运行时方法一律先判 `window.gtag` 是否存在：脚本未注入（未配置、被拦截、SSR 首帧）
// 时安全 no-op，而不是抛错——契约要求分析上报永不向业务层抛错。
//
// 无 init：采集脚本由 head().scripts 注入（见 ./scripts.ts），运行时没有初始化动作，
// 因此不实现可选的 init（避免留一个永远为空的钩子）。

import { ANALYTICS_EVENTS } from "@openstarter/analytics";
import { sanitizeProperties } from "@openstarter/analytics/runtime";

import type { AnalyticsProvider } from "@openstarter/analytics";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** 调用 gtag：脚本未就绪时静默跳过。 */
function callGtag(...args: unknown[]): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  window.gtag(...args);
}

/** GA4 的 event / set 两个命令即覆盖契约的全部语义。 */
export function createGoogleAnalyticsStrategy(): AnalyticsProvider {
  return {
    async identify(profileId, traits) {
      // user_id 与 user_properties 是 GA4 的两个独立参数面：
      // user_id 走顶层 set，画像必须走 user_properties（否则任意 key 不会生效）。
      callGtag("set", { user_id: profileId });
      const userProperties = sanitizeProperties(traits);
      if (userProperties) {
        callGtag("set", "user_properties", userProperties);
      }
    },
    name: "google-analytics",
    async reset() {
      // 登出必须同时清身份与画像，否则下一位用户会继承上一位的 user_properties。
      callGtag("set", { user_id: null });
      callGtag("set", "user_properties", {});
    },
    async setScreenName(name, params) {
      callGtag("event", ANALYTICS_EVENTS.PAGE_VIEW, {
        page_title: name,
        ...sanitizeProperties(params),
      });
    },
    async track(event, properties) {
      callGtag("event", event, sanitizeProperties(properties));
    },
  };
}
