import { describe, expect, it } from "vitest";
import type { SubscriptionStatusView } from "./state";
import { deriveState } from "./state";

const OK_ENV = {
  appUrl: "http://localhost:3000",
  ok: true as const,
  origin: "http://localhost:3000",
};
const BAD_ENV = { ok: false as const, reason: "VITE_APP_URL is not set" };

const SUBSCRIPTION: SubscriptionStatusView = {
  hasSubscription: true,
  nextBillingDate: "2026-09-01T00:00:00.000Z",
  planName: "Pro",
  status: "active",
};

describe("deriveState", () => {
  it("returns misconfigured when the env is invalid, before checking endpoints", () => {
    const state = deriveState({
      endpoints: {
        credits: { data: 10, status: "success" },
        plan: { data: "member", status: "success" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: BAD_ENV,
    });

    expect(state).toEqual({
      kind: "misconfigured",
      reason: "VITE_APP_URL is not set",
    });
  });

  it("returns signed-out when any endpoint responds 401", () => {
    const state = deriveState({
      endpoints: {
        credits: { data: 10, status: "success" },
        plan: { httpStatus: 401, message: null, status: "http-error" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: OK_ENV,
    });

    expect(state).toEqual({ kind: "signed-out" });
  });

  it("returns error with the server message for a non-401 HTTP error", () => {
    const state = deriveState({
      endpoints: {
        credits: { data: 10, status: "success" },
        plan: {
          httpStatus: 500,
          message: "Internal Server Error",
          status: "http-error",
        },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: OK_ENV,
    });

    expect(state).toEqual({ kind: "error", message: "Internal Server Error" });
  });

  it("falls back to a status-code message when the server sends no message", () => {
    const state = deriveState({
      endpoints: {
        credits: { data: 10, status: "success" },
        plan: { httpStatus: 500, message: null, status: "http-error" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: OK_ENV,
    });

    expect(state).toEqual({ kind: "error", message: "Request failed (500)" });
  });

  it("returns error on a network failure", () => {
    const state = deriveState({
      endpoints: {
        credits: { data: 10, status: "success" },
        plan: { status: "network-error" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: OK_ENV,
    });

    expect(state).toEqual({
      kind: "error",
      message: "Could not reach the OpenStarter server.",
    });
  });

  it("does not partially render: one failing endpoint degrades the whole panel", () => {
    const state = deriveState({
      endpoints: {
        credits: { httpStatus: 500, message: "boom", status: "http-error" },
        plan: { data: "member", status: "success" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: OK_ENV,
    });

    expect(state.kind).toBe("error");
  });

  it("returns ready with the combined snapshot when all endpoints succeed", () => {
    const state = deriveState({
      endpoints: {
        credits: { data: 42, status: "success" },
        plan: { data: "member", status: "success" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: OK_ENV,
    });

    expect(state).toEqual({
      data: {
        creditsBalance: 42,
        plan: "member",
        subscription: SUBSCRIPTION,
      },
      kind: "ready",
    });
  });
});
