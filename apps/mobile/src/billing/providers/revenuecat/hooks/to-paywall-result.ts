import { PAYWALL_RESULT } from "react-native-purchases-ui";

import { PaywallResult } from "../../../types";

/**
 * RC SDK 结果枚举 → 策略层 PaywallResult。default 兜底 ERROR：
 * SDK 未来新增枚举成员时不得静默返回 undefined。
 */
export const toPaywallResult = (result: PAYWALL_RESULT): PaywallResult => {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return PaywallResult.PURCHASED;
    case PAYWALL_RESULT.RESTORED:
      return PaywallResult.RESTORED;
    case PAYWALL_RESULT.CANCELLED:
      return PaywallResult.DISMISSED;
    case PAYWALL_RESULT.NOT_PRESENTED:
      return PaywallResult.SKIPPED;
    case PAYWALL_RESULT.ERROR:
      return PaywallResult.ERROR;
    default:
      return PaywallResult.ERROR;
  }
};
