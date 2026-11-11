// @openstarter/analytics-mobile —— 分析 provider 统一接口。
//
// 门面（../facade）依据配置选择一个或多个 provider 实例；所有方法都必须
// 自行消化错误（分析上报永不向业务层抛错），接口约定即错误边界。

/** 事件属性：值必须可 JSON 序列化（由各 SDK 自行校验，接口层不复制约束）。 */
export type EventProperties = Record<string, unknown>;

/** 用户 traits：identify 附带的画像字段（firstName/email/plan 等）。 */
export type UserTraits = Record<string, unknown>;

export interface AnalyticsProvider {
  /** provider 标识，供消费方打日志与测试断言。 */
  readonly name: "openpanel" | "firebase" | "noop";
  /** 初始化；幂等，重复调用无副作用。 */
  init(): Promise<void>;
  track(event: string, properties?: EventProperties): Promise<void>;
  identify(profileId: string, traits?: UserTraits): Promise<void>;
  /** null 表示清除（登出场景）。 */
  setUserId(userId: string | null): Promise<void>;
  setScreenName(name: string, params?: EventProperties): Promise<void>;
}
