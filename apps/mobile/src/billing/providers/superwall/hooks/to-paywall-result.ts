import type { PaywallState } from "expo-superwall";

import { PaywallResult } from "../../../types";

/**
 * expo-superwall 的 PaywallState 判别联合 → 策略层 PaywallResult。
 * default 兜底 ERROR：SDK 未来新增状态时不得静默返回 undefined。
 */
export const toPaywallResult = (state: PaywallState): PaywallResult => {
  switch (state.status) {
    case "idle":
      return PaywallResult.IDLE;
    case "presented":
      return PaywallResult.IDLE;
    case "dismissed":
      if (state.result.type === "purchased") return PaywallResult.PURCHASED;
      if (state.result.type === "restored") return PaywallResult.RESTORED;
      return PaywallResult.DISMISSED;
    case "skipped":
      return PaywallResult.SKIPPED;
    case "error":
      return PaywallResult.ERROR;
    default:
      return PaywallResult.ERROR;
  }
};
