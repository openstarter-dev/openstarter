// packages/api/src/ai/errors —— AI 域可识别错误与结构化错误信息（R19.3/R19.4）。
//
// 明确区分「配置态不可用」与「运行态供应商错误」两类，分别对应两条需求：
//
//   - {@link AIProviderUnavailableError}（R19.3，配置态）：所选供应商未启用或凭证缺失时抛出，
//     使路由分派能明确「拒绝」并返回可识别的不可用错误。写法与 `@openstarter/billing` 的
//     `PaymentProviderUnavailableError` 同构（继承 Error、稳定 `name`、只读领域字段），
//     由路由层 / app.onError 统一转为结构化响应。
//
//   - {@link AIProviderErrorInfo}（R19.4，运行态）：供应商返回错误响应或调用过程抛错时，
//     由路由分派「捕获并归一化」为此结构化信息，随判别联合结果 `{ success:false, error }`
//     回传调用方——不抛未捕获异常、不使进程崩溃（结构化回传，见 service.dispatchGenerate）。
//
// 二者的本质区别：前者是配置态（能不能用这个渠道）→ 明确拒绝；后者是运行态（用的过程失败了）
// → 结构化回传且不崩溃。

/**
 * 供应商不可用错误（R19.3）：所选 AI 供应商在 Config 中未启用或凭证缺失时抛出，
 * 使路由分派能明确拒绝并返回可识别的错误信息（与支付渠道不可用同构）。
 */
export class AIProviderUnavailableError extends Error {
  readonly provider: string;

  constructor(provider: string) {
    super(`AI provider '${provider}' is not enabled or its credentials are missing`);
    this.name = "AIProviderUnavailableError";
    this.provider = provider;
  }
}

/**
 * 结构化供应商错误信息（R19.4）：供应商运行态失败经归一化后的可回传结构。
 * 作为判别联合失败分支的 `error` 载荷，字段稳定、可序列化，便于路由层直接以 JSON 回传，
 * 也便于任务与积分联动（任务 27）据此把任务置为失败并撤销已扣积分。
 * - `provider` / `model`：定位是哪个供应商/模型失败。
 * - `statusCode`：供应商 HTTP 状态码（如有），用于诊断。
 * - `message`：可读的失败原因（已归一化，不含敏感信息 / 堆栈）。
 */
export interface AIProviderErrorInfo {
  provider: string;
  model?: string;
  statusCode?: number;
  message: string;
}

/**
 * 把任意抛出的原始错误归一化为 {@link AIProviderErrorInfo}（R19.4）。
 * 仅提取可读消息与可选状态码，绝不外泄堆栈；未知错误回退为通用消息。
 */
export function normalizeProviderError(args: {
  provider: string;
  model?: string;
  error: unknown;
  statusCode?: number;
}): AIProviderErrorInfo {
  const { provider, model, error, statusCode } = args;
  const message = error instanceof Error ? error.message : "unknown AI provider error";
  return { provider, model, statusCode, message };
}

/**
 * 供应商请求返回非 2xx 时抛出，携带状态码，供路由分派归一化为 {@link AIProviderErrorInfo}。
 * 属运行态错误（R19.4），最终以结构化信息回传，不使进程崩溃。
 */
export class AIProviderRequestError extends Error {
  readonly provider: string;
  readonly statusCode: number;

  constructor(provider: string, statusCode: number, detail?: string) {
    super(
      detail
        ? `AI provider '${provider}' request failed with status ${statusCode}: ${detail}`
        : `AI provider '${provider}' request failed with status ${statusCode}`,
    );
    this.name = "AIProviderRequestError";
    this.provider = provider;
    this.statusCode = statusCode;
  }
}
