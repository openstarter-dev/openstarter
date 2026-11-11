// @openstarter/analytics —— 分析能力的**唯一类型契约**（主入口零运行时、零依赖）。
//
// 仓库内三个平台各自实现本契约，互不 import 对方：
//   - @openstarter/analytics-web        （apps/web，TanStack Start：脚本注入 + 运行时策略）
//   - @openstarter/analytics-mobile     （apps/mobile，Expo：OpenPanel / Firebase）
//   - @openstarter/analytics-extension  （apps/extension，WXT：Plausible HTTP / noop）
//
// 之所以把契约单独成包而不是放在任一平台包里：平台包之间存在环境差异（RN 无 window、
// 扩展无 DOM 路由、服务端无 SDK），但**对外语义必须一致**——消费方只依赖契约类型，
// 切换/新增平台时业务代码不需要改。本入口刻意只含类型与常量：任何平台特有的运行时
// 代码都会把某个环境假设（DOM、chrome、RN）泄漏给其它平台；跨平台通用的运行时工具
// 放在 ./runtime 子入口（同样零平台依赖）。

/** 事件属性：值必须可 JSON 序列化（深度/长度约束见 runtime/sanitize）。 */
export type EventProperties = Record<string, unknown>;

/** 用户 traits：identify 附带的画像字段（email/name/plan 等）。 */
export type UserTraits = Record<string, unknown>;

/**
 * 真实供应商（可配置的第三方服务）。闭集合而非 string：新增供应商必须同时更新契约，
 * 避免各平台静默接受拼错的标识。
 */
export type AnalyticsProviderName =
  | "google-analytics"
  | "plausible"
  | "openpanel"
  | "firebase";

/**
 * 策略名 = 真实供应商 + 两个内置策略：
 *   - `noop`：未配置任何供应商时的空实现；
 *   - `composite`：多供应商同时启用时的事件转发聚合。
 * 与 AnalyticsProviderName 分开，避免「遍历已配置供应商」时把策略误当成供应商。
 */
export type AnalyticsStrategyName = AnalyticsProviderName | "noop" | "composite";

/** 契约方法名，供错误上下文精确定位。 */
export type AnalyticsMethod = "init" | "track" | "identify" | "reset" | "setScreenName";

/** 错误上下文：哪个策略、哪个方法失败。 */
export interface AnalyticsErrorContext {
  readonly method: AnalyticsMethod;
  readonly provider: AnalyticsStrategyName;
}

/**
 * 错误出口：默认不实现（错误被静默消化），接入方可在初始化时传入
 * （例如转发到 Sentry），这样既保持「上报不得抛错」，又保留可观测性。
 */
export type AnalyticsErrorHandler = (error: unknown, context: AnalyticsErrorContext) => void;

/**
 * 单供应商统一接口 —— 各平台实现必须以 `satisfies AnalyticsProvider` 落地。
 *
 * 约定（比方法签名更重要）：
 *   1. **错误边界在本层**：任何方法都不得向业务层抛错（SDK 缺失、网络失败、权限被拒
 *      一律内部消化）。消费方可以无 try/catch 地调用。
 *   2. **init 可选**：只有需要显式初始化 SDK 的平台才实现（如 React Native 的
 *      OpenPanel / Firebase）；web 端脚本由页面注入、extension 直接发 HTTP，都无需 init。
 *      重复调用必须幂等。
 *   3. **reset 用于登出**：清除用户身份（含供应商侧的 user properties）。
 */
export interface AnalyticsProvider {
  /** 策略标识，供消费方打日志与测试断言。 */
  readonly name: AnalyticsStrategyName;
  /** 初始化（可选）；幂等，重复调用无副作用。 */
  init?(): Promise<void>;
  /** 上报自定义事件。 */
  track(event: string, properties?: EventProperties): Promise<void>;
  /** 绑定用户身份（登录后调用）。 */
  identify(profileId: string, traits?: UserTraits): Promise<void>;
  /** 清除用户身份（登出后调用）。 */
  reset(): Promise<void>;
  /** 上报页面/屏幕事件。 */
  setScreenName(name: string, params?: EventProperties): Promise<void>;
}

/**
 * 服务端策略 —— 只能在服务端运行的事件上报（支付成功、订阅变更等由后端确认的事实）。
 * 契约有意比客户端窄：服务端没有 UI，无需 identify / reset / setScreenName。
 */
export interface AnalyticsServerStrategy {
  track(event: string, properties?: EventProperties): Promise<void>;
}
