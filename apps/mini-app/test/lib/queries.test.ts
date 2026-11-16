import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSignInEmail, mockSignOut, mockGetProfile, mockSetSession } = vi.hoisted(() => ({
  mockSignInEmail: vi.fn(),
  mockSignOut: vi.fn(),
  mockGetProfile: vi.fn(),
  mockSetSession: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: mockSignInEmail },
    signOut: mockSignOut,
  },
}));
vi.mock("@/services/client", () => ({
  client: { get: mockGetProfile },
}));
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: {
    getState: () => ({ setSession: mockSetSession }),
  },
}));

describe("profileQueries.detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should unwrap profile data and pass the abort signal", async () => {
    const { profileQueries } = await import("../../src/lib/queries");
    const profile = { id: "u1", email: "a@b.c", name: "Alice", createdAt: null };
    mockGetProfile.mockResolvedValue({ ok: true, json: async () => ({ data: profile }) });

    const controller = new AbortController();
    const options = profileQueries.detail();
    const data = await options.queryFn!({ signal: controller.signal } as any);

    expect(data).toEqual(profile);
    expect(options.queryKey).toEqual(["profile", "detail"]);
    expect(mockGetProfile).toHaveBeenCalledWith("/api/profile", {
      signal: controller.signal,
    });
  });

  it("should throw the server message on error response", async () => {
    const { profileQueries } = await import("../../src/lib/queries");
    mockGetProfile.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Unauthorized" }),
    });

    await expect(
      profileQueries.detail().queryFn!({ signal: new AbortController().signal } as any),
    ).rejects.toThrow("Unauthorized");
  });
});

describe("authMutations.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should capture the bearer token and set the session", async () => {
    const { authMutations } = await import("../../src/lib/queries");
    const user = { id: "u1", email: "a@b.c", name: "Alice" };
    mockSignInEmail.mockImplementation(async (_vars: unknown, opts: any) => {
      opts.onSuccess({
        response: {
          headers: {
            get: (name: string) => (name === "set-auth-token" ? "tok123" : null),
          },
        },
      });
      return { data: { user }, error: null };
    });

    const result = await authMutations.login().mutationFn!(
      { email: "a@b.c", password: "pw" },
      {} as any,
    );

    expect(mockSetSession).toHaveBeenCalledWith("tok123", user);
    expect(result).toEqual({ user });
  });

  it("should throw the server error message", async () => {
    const { authMutations } = await import("../../src/lib/queries");
    mockSignInEmail.mockResolvedValue({
      data: null,
      error: { message: "Invalid credentials" },
    });

    await expect(
      authMutations.login().mutationFn!({ email: "a@b.c", password: "pw" }, {} as any),
    ).rejects.toThrow("Invalid credentials");
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it("should throw when token or user is missing", async () => {
    const { authMutations } = await import("../../src/lib/queries");
    mockSignInEmail.mockResolvedValue({ data: { user: null }, error: null });

    await expect(
      authMutations.login().mutationFn!({ email: "a@b.c", password: "pw" }, {} as any),
    ).rejects.toThrow("Login failed: missing token or user");
    expect(mockSetSession).not.toHaveBeenCalled();
  });
});

describe("authMutations.logout", () => {
  it("should sign out and declare profile invalidation", async () => {
    const { authMutations, profileKeys } = await import("../../src/lib/queries");
    mockSignOut.mockResolvedValue({});

    const options = authMutations.logout();
    await options.mutationFn!(undefined as any, {} as any);

    expect(mockSignOut).toHaveBeenCalled();
    expect(options.meta).toEqual({ invalidates: [profileKeys.all] });
  });
});
