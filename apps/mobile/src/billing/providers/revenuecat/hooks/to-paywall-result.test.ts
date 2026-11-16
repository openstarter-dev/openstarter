import { describe, expect, it, vi } from "vitest";

// react-native-purchases-ui 的 CJS 入口顶层 require("react-native")（Flow 语法），
// node 环境无法解析——mock 之。PAYWALL_RESULT 的字符串值与 SDK 枚举逐字对应
// （@revenuecat/purchases-typescript-internal dist/enums.d.ts），映射逻辑本身全真。
vi.mock("react-native-purchases-ui", () => ({
  PAYWALL_RESULT: {
    NOT_PRESENTED: "NOT_PRESENTED",
    ERROR: "ERROR",
    CANCELLED: "CANCELLED",
    PURCHASED: "PURCHASED",
    RESTORED: "RESTORED",
  },
}));

import { PaywallResult } from "../../../types";
import { toPaywallResult } from "./to-paywall-result";

describe("toPaywallResult（RC PAYWALL_RESULT 映射）", () => {
  it("PURCHASED → PURCHASED", () => {
    expect(toPaywallResult("PURCHASED" as never)).toBe(PaywallResult.PURCHASED);
  });

  it("RESTORED → RESTORED", () => {
    expect(toPaywallResult("RESTORED" as never)).toBe(PaywallResult.RESTORED);
  });

  it("CANCELLED → DISMISSED", () => {
    expect(toPaywallResult("CANCELLED" as never)).toBe(PaywallResult.DISMISSED);
  });

  it("NOT_PRESENTED → SKIPPED", () => {
    expect(toPaywallResult("NOT_PRESENTED" as never)).toBe(PaywallResult.SKIPPED);
  });

  it("ERROR → ERROR", () => {
    expect(toPaywallResult("ERROR" as never)).toBe(PaywallResult.ERROR);
  });

  it("未知值兜底 → ERROR（default 分支，防 SDK 新增枚举成员时静默 undefined）", () => {
    expect(toPaywallResult("SOME_FUTURE_RESULT" as never)).toBe(PaywallResult.ERROR);
  });
});
