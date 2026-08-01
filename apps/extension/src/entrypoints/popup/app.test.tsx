import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AppDeps } from "./app";
import { App } from "./app";

const OK_ENV = {
  appUrl: "http://localhost:3000",
  ok: true as const,
  origin: "http://localhost:3000",
};

// 顶层正则（Ultracite useTopLevelRegex）。
const MISCONFIGURED_LABEL = /VITE_APP_URL is not set/i;

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    env: OK_ENV,
    fetchCredits: vi.fn().mockResolvedValue({ data: 42, status: "success" }),
    fetchPlan: vi.fn().mockResolvedValue({ data: "member", status: "success" }),
    fetchSubscription: vi.fn().mockResolvedValue({
      data: {
        hasSubscription: true,
        nextBillingDate: null,
        planName: "Pro",
        status: "active",
      },
      status: "success",
    }),
    fetchUser: vi
      .fn()
      .mockResolvedValue({ email: "user@example.com", name: "Ada" }),
    onManage: vi.fn(),
    onSignIn: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  };
}

describe("App", () => {
  it("shows the account panel once all endpoints resolve", async () => {
    render(<App deps={makeDeps()} />);

    await waitFor(() => {
      expect(screen.getByText("member")).toBeTruthy();
    });
  });

  it("shows the account panel even if fetchUser fails, just without the identity row", async () => {
    render(
      <App deps={makeDeps({ fetchUser: vi.fn().mockResolvedValue(null) })} />
    );

    await waitFor(() => {
      expect(screen.getByText("member")).toBeTruthy();
    });
    expect(screen.queryByText("user@example.com")).toBeNull();
  });

  it("shows the misconfigured message when the env is invalid", async () => {
    render(
      <App
        deps={makeDeps({
          env: { ok: false, reason: "VITE_APP_URL is not set" },
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(MISCONFIGURED_LABEL)).toBeTruthy();
    });
  });

  it("shows the signed-out view on a 401", async () => {
    render(
      <App
        deps={makeDeps({
          fetchPlan: vi.fn().mockResolvedValue({
            httpStatus: 401,
            message: null,
            status: "http-error",
          }),
        })}
      />
    );

    await waitFor(() => {
      // "/sign in/i" 同时命中段落文案与按钮，故改用 getByRole("button", name:"Sign in") 精确锁定。
      expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    });
  });
});
