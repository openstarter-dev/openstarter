// 语义事件常量 —— 跨端事件的**单一事实源**。
//
// 为什么要这层：GA4 用 `page_view`、Firebase 用 `screen_view`、Plausible 用
// `pageview`，三家的原生事件名天然不同（强行统一会破坏供应商语义）。所以这里统一的
// 是「语义」，不是字符串：业务代码只引用语义常量，各 provider 在映射层转成自家的规范名。
// 跨端做漏斗时按语义对齐（见 README 的能力矩阵），而不是猜对方用了哪个字符串。

export const ANALYTICS_EVENTS = {
  /** 用户登录成功（客户端）。 */
  LOGIN: "login",
  /** 页面浏览（web 语义；GA4 原生 page_view）。 */
  PAGE_VIEW: "page_view",
  /** 支付/购买成功（服务端语义，建议由 server strategy 上报）。 */
  PURCHASE: "purchase",
  /** 屏幕浏览（移动端语义；Firebase/OpenPanel 原生 screen_view）。 */
  SCREEN_VIEW: "screen_view",
  /** 用户注册成功（客户端）。 */
  SIGNUP: "signup",
} as const;

/**
 * 允许自定义事件名（starter 的业务事件无法预先枚举），但字符串字面量仍能获得
 * 常量表补全 —— `(string & {})` 是保留自动补全的惯用写法。
 */
export type AnalyticsEventName =
  | (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]
  | (string & {});
