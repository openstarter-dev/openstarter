// apps/extension/src/lib/state.ts —— popup 的纯函数状态机。
// 见 spec §6（五态穷举）/§7（错误处理四条约定）。
// 刻意把"读 cookie"和"发请求"的结果作为已分类的输入传入，使这个函数本身
// 不接触 chrome API 或网络，可以在不 mock 任何浏览器全局的情况下测试。
import type { EnvResult } from "./env";

export type UserPlan = "none" | "trial" | "expired" | "member";

export interface SubscriptionStatusView {
  hasSubscription: boolean;
  nextBillingDate: string | null;
  planName: string | null;
  status: string | null;
}

export interface AccountSnapshot {
  creditsBalance: number;
  plan: UserPlan;
  subscription: SubscriptionStatusView;
}

export type PanelState =
  | { kind: "loading" }
  | { kind: "misconfigured"; reason: string }
  | { kind: "signed-out" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: AccountSnapshot };

export type EndpointResult<T> =
  | { status: "success"; data: T }
  | { status: "http-error"; httpStatus: number; message: string | null }
  | { status: "network-error" };

const UNREACHABLE_MESSAGE = "Could not reach the OpenStarter server.";
const UNAUTHORIZED_STATUS = 401;

function endpointError<T>(result: EndpointResult<T>):
  | {
      kind: "signed-out";
    }
  | { kind: "error"; message: string }
  | null {
  if (result.status === "success") {
    return null;
  }
  if (result.status === "network-error") {
    return { kind: "error", message: UNREACHABLE_MESSAGE };
  }
  if (result.httpStatus === UNAUTHORIZED_STATUS) {
    return { kind: "signed-out" };
  }
  return {
    kind: "error",
    message: result.message ?? `Request failed (${result.httpStatus})`,
  };
}

export function deriveState(input: {
  env: EnvResult;
  endpoints: {
    plan: EndpointResult<UserPlan>;
    credits: EndpointResult<number>;
    subscription: EndpointResult<SubscriptionStatusView>;
  };
}): PanelState {
  if (!input.env.ok) {
    return { kind: "misconfigured", reason: input.env.reason };
  }

  const { plan, credits, subscription } = input.endpoints;

  // 逐一检查而非遍历数组：三端点的 EndpointResult 具有不同的 T（UserPlan / number /
  // SubscriptionStatusView），遍历会把它们并成一个联合类型，使 endpointError<T> 无法对
  // 单个元素独立推断 T 而触发类型不兼容。显式逐个调用绕开该问题，同时保留"任一失败即
  // 整体降级"的语义（spec §7 第 4 条）。
  const failure =
    endpointError(plan) ??
    endpointError(credits) ??
    endpointError(subscription);
  if (failure) {
    return failure;
  }

  // endpointError returns null only when status === "success", but TypeScript
  // cannot propagate that fact back to narrow `plan`/`credits`/`subscription`
  // across the `??` chain. Re-check the discriminant here to narrow each `data`.
  if (
    plan.status !== "success" ||
    credits.status !== "success" ||
    subscription.status !== "success"
  ) {
    return { kind: "error", message: UNREACHABLE_MESSAGE };
  }

  return {
    data: {
      creditsBalance: credits.data,
      plan: plan.data,
      subscription: subscription.data,
    },
    kind: "ready",
  };
}
