// apps/extension/src/components/account-panel.test.tsx —— 覆盖只读账户面板的关键渲染
// 需求：方案徽章、积分余额、订阅状态、邮箱身份行、退出登录的共享会话提示。
// 仓库不引入 @testing-library/jest-dom 的 toBeInTheDocument 匹配器（无既有使用、避免新增依赖），
// 改用 getByText 在找不到时抛错这一事实 + 显式 .toBeTruthy 断言。
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AccountSnapshot } from "../lib/types";
import { AccountPanel } from "./account-panel";

// 顶层正则（Ultracite useTopLevelRegex 要求正则字面量定义在模块顶层作用域）。
const SHARED_SESSION_WARNING = /also sign you out of the web app/i;

const SNAPSHOT: AccountSnapshot = {
  creditsBalance: 42,
  plan: "member",
  subscription: {
    hasSubscription: true,
    nextBillingDate: "2026-09-01T00:00:00.000Z",
    planName: "Pro",
    status: "active",
  },
};

describe("AccountPanel", () => {
  it("renders the plan, credits balance, and subscription status", () => {
    render(
      <AccountPanel
        data={SNAPSHOT}
        onManage={vi.fn()}
        onSignOut={vi.fn()}
        user={{ email: "user@example.com", name: "Ada" }}
      />
    );

    expect(screen.getByText("member")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("renders without the identity row when user is null", () => {
    render(
      <AccountPanel
        data={SNAPSHOT}
        onManage={vi.fn()}
        onSignOut={vi.fn()}
        user={null}
      />
    );

    expect(screen.getByText("member")).toBeTruthy();
  });

  it("renders a sign-out warning about the shared web session", () => {
    render(
      <AccountPanel
        data={SNAPSHOT}
        onManage={vi.fn()}
        onSignOut={vi.fn()}
        user={{ email: "user@example.com", name: "Ada" }}
      />
    );

    expect(screen.getByText(SHARED_SESSION_WARNING)).toBeTruthy();
  });
});
