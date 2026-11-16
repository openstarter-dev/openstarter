import { describe, expect, it, vi } from "vitest";

// expo-superwall 顶层 requireNativeModule（Expo Go 崩溃源），node 环境必须 mock。
// 纯映射单测不需要其运行时，只需类型侧的判别联合形状（与 build/src/usePlacement.d.ts
// 的 PaywallState / SuperwallExpoModule.types.d.ts 的 PaywallResult 逐字对应）。
vi.mock("expo-superwall", () => ({}));

import { PaywallResult } from "../../../types";
import { toPaywallResult } from "./to-paywall-result";

const state = (status: string, extra: Record<string, unknown> = {}) =>
  ({ status, ...extra }) as never;

describe("toPaywallResult（superwall PaywallState 映射）", () => {
  it("idle → IDLE", () => {
    expect(toPaywallResult(state("idle"))).toBe(PaywallResult.IDLE);
  });

  it("presented → IDLE（展示中视为尚未产生结果）", () => {
    expect(toPaywallResult(state("presented", { paywallInfo: {} }))).toBe(PaywallResult.IDLE);
  });

  it("dismissed + purchased → PURCHASED", () => {
    expect(toPaywallResult(state("dismissed", { result: { type: "purchased" } }))).toBe(
      PaywallResult.PURCHASED,
    );
  });

  it("dismissed + restored → RESTORED", () => {
    expect(toPaywallResult(state("dismissed", { result: { type: "restored" } }))).toBe(
      PaywallResult.RESTORED,
    );
  });

  it("dismissed + declined → DISMISSED", () => {
    expect(toPaywallResult(state("dismissed", { result: { type: "declined" } }))).toBe(
      PaywallResult.DISMISSED,
    );
  });

  it("skipped → SKIPPED", () => {
    expect(toPaywallResult(state("skipped", { reason: { type: "Holdout" } }))).toBe(
      PaywallResult.SKIPPED,
    );
  });

  it("error → ERROR", () => {
    expect(toPaywallResult(state("error", { error: "boom" }))).toBe(PaywallResult.ERROR);
  });

  it("未知 status 兜底 → ERROR（default 分支，防 SDK 新增状态时静默 undefined）", () => {
    expect(toPaywallResult(state("some_future_state"))).toBe(PaywallResult.ERROR);
  });
});
