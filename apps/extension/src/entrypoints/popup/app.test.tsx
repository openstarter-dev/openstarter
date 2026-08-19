import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { ApiClientProvider } from "../../lib/api-context";
import { AuthStateProvider, useSetSignedOut } from "../../lib/auth-state";
import type { AppDeps } from "./app";
import { App } from "./app";

// Mock the browser tabs API
vi.mock("wxt/browser", () => ({
  browser: {
    tabs: {
      create: vi.fn(),
    },
  },
}));

const OK_ENV = {
  appUrl: "http://localhost:3000",
  ok: true as const,
  origin: "http://localhost:3000",
};

const MISCONFIGURED_LABEL = /VITE_APP_URL is not set/i;

function createMockApi() {
  return {
    api: {
      user: {
        credits: {
          $get: vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => ({ data: { balance: 42 } }) }),
        },
        plan: {
          $get: vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => ({ data: { plan: "member" } }) }),
        },
        subscription: {
          $get: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
              data: {
                hasSubscription: true,
                nextBillingDate: null,
                planName: "Pro",
                status: "active",
              },
            }),
          }),
        },
      },
    },
    getSession: vi.fn().mockResolvedValue({
      data: { user: { name: "Ada", email: "user@example.com" } },
    }),
  };
}

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    env: OK_ENV,
    onManage: vi.fn(),
    onSignIn: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockApi = ReturnType<typeof createMockApi>;

function SignedOutTrigger() {
  const setSignedOut = useSetSignedOut();
  useEffect(() => {
    setSignedOut();
  }, [setSignedOut]);
  return null;
}

interface TestWrapperProps {
  api: MockApi;
  children: ReactNode;
  isSignedOut?: boolean;
  queryClient: QueryClient;
}

function TestWrapper({ api, children, isSignedOut, queryClient }: TestWrapperProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider value={{ api: api as never, auth: api as never }}>
        <AuthStateProvider>
          {isSignedOut ? <SignedOutTrigger /> : null}
          {children}
        </AuthStateProvider>
      </ApiClientProvider>
    </QueryClientProvider>
  );
}

describe("App", () => {
  it("shows the account panel once all endpoints resolve", async () => {
    const mockApi = createMockApi();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <TestWrapper api={mockApi} queryClient={queryClient}>
        <App deps={makeDeps()} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("member")).toBeTruthy();
    });
  });

  it("shows the account panel even if user fetch fails, just without the identity row", async () => {
    const mockApi = createMockApi();
    mockApi.getSession.mockResolvedValue({ data: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <TestWrapper api={mockApi} queryClient={queryClient}>
        <App deps={makeDeps()} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("member")).toBeTruthy();
    });
    expect(screen.queryByText("user@example.com")).toBeNull();
  });

  it("shows the misconfigured message when the env is invalid", async () => {
    const mockApi = createMockApi();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <TestWrapper api={mockApi} queryClient={queryClient}>
        <App
          deps={makeDeps({
            env: { ok: false, reason: "VITE_APP_URL is not set" },
          })}
        />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(MISCONFIGURED_LABEL)).toBeTruthy();
    });
  });

  it("shows the signed-out view when isSignedOut is true", async () => {
    const mockApi = createMockApi();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <TestWrapper api={mockApi} queryClient={queryClient} isSignedOut>
        <App deps={makeDeps()} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    });
  });

  it("shows loading state while queries are pending", async () => {
    const mockApi = createMockApi();
    // Make the API calls never resolve to simulate pending state
    mockApi.api.user.credits.$get.mockReturnValue(new Promise(() => {}));
    mockApi.api.user.plan.$get.mockReturnValue(new Promise(() => {}));
    mockApi.api.user.subscription.$get.mockReturnValue(new Promise(() => {}));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });

    render(
      <TestWrapper api={mockApi} queryClient={queryClient}>
        <App deps={makeDeps()} />
      </TestWrapper>,
    );

    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("shows error state when a query fails", async () => {
    const mockApi = createMockApi();
    // Make credits query fail
    mockApi.api.user.credits.$get.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Server error" }),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <TestWrapper api={mockApi} queryClient={queryClient}>
        <App deps={makeDeps()} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/HTTP 500/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
