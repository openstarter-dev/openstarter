// @openstarter/analytics-mobile/internal —— 平台内 provider 类型（包内模块，对外经 ../index.ts 转出）。
//
// 跨平台契约（AnalyticsProvider / EventProperties / UserTraits）在 @openstarter/analytics，
// 本文件不重新定义语义，只做两件事：
//   1. 原样转发契约类型，让移动端消费方无需再 import 契约包；
//   2. 声明移动端扩展能力 setUserId。
//
// 为什么 setUserId 不进跨平台契约：GA 与 OpenPanel 都把「已登录用户 ID」与「用户画像」
// 分开建模（setUserId 不带 traits，null 即清除），而 web 的脚本型供应商（Plausible）根本没有
// 这个概念。把它塞进契约会逼 web 端实现空方法，属于为一致性牺牲准确性；反之作为移动端
// 扩展能力保留，跨平台消费方仍只依赖契约。

export type {
  AnalyticsProvider,
  AnalyticsProviderName,
  AnalyticsStrategyName,
  EventProperties,
  UserTraits,
} from "@openstarter/analytics";

import type { AnalyticsProvider } from "@openstarter/analytics";

/** 移动端 provider：契约 + 身份绑定能力。 */
export interface MobileAnalyticsProvider extends AnalyticsProvider {
  /**
   * 初始化。跨平台契约里 init 是可选的（web/extension 无 SDK 初始化），
   * 但移动端 SDK（OpenPanel / Firebase）需要显式生命周期钩子，因此在这里收窄为必需。
   */
  init(): Promise<void>;
  /** 设置/清除当前用户 ID（null 清除）。identify 负责画像，本方法只负责身份绑定。 */
  setUserId(userId: string | null): Promise<void>;
}
