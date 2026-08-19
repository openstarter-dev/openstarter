import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { ApiClientProvider } from "./api-context";
import { useCreditsQuery, usePlanQuery, useSubscriptionQuery } from "./hooks";

// Helper to create a mock API response
function mockResponse<T>(
  data: T,
  ok = true,
): { ok: boolean; json: () => Promise<T>; status: number } {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
  };
}

// Create mock API client
function createMockApi() {
  return {
    api: {
      user: {
        credits: { $get: vi.fn() },
        plan: { $get: vi.fn() },
        subscription: { $get: vi.fn() },
      },
    },
  };
}

// Create a test wrapper that provides both API client and QueryClient
function createTestWrapper(mockApi: ReturnType<typeof createMockApi>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockApiClientValue = { api: mockApi as any, auth: {} as any };

  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <ApiClientProvider value={mockApiClientValue}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiClientProvider>
    );
  };
}

describe("useCreditsQuery", () => {
  it("returns loading state initially", () => {
    const mockApi = createMockApi();
    mockApi.api.user.credits.$get.mockResolvedValue(mockResponse({ data: { balance: 100 } }));

    const { result } = renderHook(() => useCreditsQuery(), {
      wrapper: createTestWrapper(mockApi),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("returns credits balance on success", async () => {
    const mockApi = createMockApi();
    mockApi.api.user.credits.$get.mockResolvedValue(mockResponse({ data: { balance: 100 } }));

    const { result } = renderHook(() => useCreditsQuery(), {
      wrapper: createTestWrapper(mockApi),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(100);
    expect(mockApi.api.user.credits.$get).toHaveBeenCalledWith({ query: {} });
  });

  it("returns error state when API call fails", async () => {
    const mockApi = createMockApi();
    mockApi.api.user.credits.$get.mockResolvedValue(mockResponse({ data: null }, false));

    const { result } = renderHook(() => useCreditsQuery(), {
      wrapper: createTestWrapper(mockApi),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("HTTP 500");
  });
});

describe("usePlanQuery", () => {
  it("returns loading state initially", () => {
    const mockApi = createMockApi();
    mockApi.api.user.plan.$get.mockResolvedValue(mockResponse({ data: { plan: "member" } }));

    const { result } = renderHook(() => usePlanQuery(), {
      wrapper: createTestWrapper(mockApi),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("returns plan on success", async () => {
    const mockApi = createMockApi();
    mockApi.api.user.plan.$get.mockResolvedValue(mockResponse({ data: { plan: "member" } }));

    const { result } = renderHook(() => usePlanQuery(), {
      wrapper: createTestWrapper(mockApi),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe("member");
    expect(mockApi.api.user.plan.$get).toHaveBeenCalled();
  });

  it("returns error state when API call fails", async () => {
    const mockApi = createMockApi();
    mockApi.api.user.plan.$get.mockResolvedValue(mockResponse({ data: null }, false));

    const { result } = renderHook(() => usePlanQuery(), {
      wrapper: createTestWrapper(mockApi),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("HTTP 500");
  });
});

describe("useSubscriptionQuery", () => {
  it("returns loading state initially", () => {
    const mockApi = createMockApi();
    mockApi.api.user.subscription.$get.mockResolvedValue(
      mockResponse({
        data: {
          hasSubscription: true,
          status: "active",
          planName: "Pro",
          nextBillingDate: null,
        },
      }),
    );

    const { result } = renderHook(() => useSubscriptionQuery(), {
      wrapper: createTestWrapper(mockApi),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("returns subscription data on success", async () => {
    const mockApi = createMockApi();
    const subscriptionData = {
      hasSubscription: true,
      status: "active",
      planName: "Pro",
      nextBillingDate: null,
    };
    mockApi.api.user.subscription.$get.mockResolvedValue(mockResponse({ data: subscriptionData }));

    const { result } = renderHook(() => useSubscriptionQuery(), {
      wrapper: createTestWrapper(mockApi),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(subscriptionData);
    expect(mockApi.api.user.subscription.$get).toHaveBeenCalled();
  });

  it("returns error state when API call fails", async () => {
    const mockApi = createMockApi();
    mockApi.api.user.subscription.$get.mockResolvedValue(mockResponse({ data: null }, false));

    const { result } = renderHook(() => useSubscriptionQuery(), {
      wrapper: createTestWrapper(mockApi),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("HTTP 500");
  });
});
