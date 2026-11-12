import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AccountSnapshot } from "../lib/types";
import { AccountPanel } from "./account-panel";

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
      />,
    );

    expect(screen.getByText("member")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("renders without the identity row when user is null", () => {
    render(<AccountPanel data={SNAPSHOT} onManage={vi.fn()} onSignOut={vi.fn()} user={null} />);

    expect(screen.getByText("member")).toBeTruthy();
  });

  it("renders a sign-out warning about the shared web session", () => {
    render(
      <AccountPanel
        data={SNAPSHOT}
        onManage={vi.fn()}
        onSignOut={vi.fn()}
        user={{ email: "user@example.com", name: "Ada" }}
      />,
    );

    expect(screen.getByText(SHARED_SESSION_WARNING)).toBeTruthy();
  });
});
