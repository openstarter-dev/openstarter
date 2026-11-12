import { describe, expect, it, vi } from "vitest";

vi.mock("@openstarter/billing-mobile", () => ({
  Provider: ({ children }: { children: React.ReactNode }) => children,
  useCustomer: () => ({
    customer: null,
    entitlements: [],
    identify: vi.fn(),
    reset: vi.fn(),
    restore: vi.fn().mockResolvedValue(false),
    addCustomerInfoListener: () => () => undefined,
    linkToPortal: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("./auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

import { resolveLifecycleAction } from "./use-billing";

describe("resolveLifecycleAction（会话联动决策）", () => {
  it("isPending → null（读会话中间态不得触发 identify/reset）", () => {
    expect(resolveLifecycleAction({ isPending: true, userId: "u1" })).toBeNull();
    expect(resolveLifecycleAction({ isPending: true, userId: undefined })).toBeNull();
  });

  it("已登录（userId 存在）→ identify", () => {
    expect(resolveLifecycleAction({ isPending: false, userId: "user-123" })).toBe("identify");
  });

  it("未登录（无会话）→ reset", () => {
    expect(resolveLifecycleAction({ isPending: false, userId: undefined })).toBe("reset");
    expect(resolveLifecycleAction({ isPending: false, userId: null })).toBe("reset");
  });
});
