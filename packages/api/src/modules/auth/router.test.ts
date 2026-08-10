import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  authHandler: vi.fn(),
  getSession: vi.fn(),
  unlinkAccountSafely: vi.fn(),
}));

vi.mock("@openstarter/auth", () => {
  const unusedService = vi.fn();
  return {
    assignPermissionsToRole: unusedService,
    assignRoleToUser: unusedService,
    createApiKey: unusedService,
    createAuth: () => ({
      api: { getSession: authMocks.getSession },
      handler: authMocks.authHandler,
    }),
    createPermission: unusedService,
    createRole: unusedService,
    deletePermission: unusedService,
    deleteRole: unusedService,
    getPermissions: unusedService,
    getRolePermissions: unusedService,
    getRoles: unusedService,
    getUserPermissionCodes: unusedService,
    getUserRoles: unusedService,
    listApiKeys: unusedService,
    matchPermission: unusedService,
    removeRoleFromUser: unusedService,
    revokeApiKey: unusedService,
    updatePermission: unusedService,
    updateRole: unusedService,
    validateApiKey: unusedService,
  };
});

vi.mock("@openstarter/auth/server", () => ({
  createAuth: () => ({
    api: { getSession: authMocks.getSession },
    handler: authMocks.authHandler,
  }),
}));

vi.mock("@openstarter/auth/accounts/unlink", () => ({
  AccountUnlinkError: class AccountUnlinkError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  unlinkAccountSafely: authMocks.unlinkAccountSafely,
}));

import { app } from "../../index";
import { authRouter } from "./router";

beforeEach(() => {
  authMocks.authHandler.mockReset();
  authMocks.getSession.mockReset();
  authMocks.unlinkAccountSafely.mockReset();
});

describe("safe account unlink route", () => {
  it("rejects requests without a session", async () => {
    authMocks.getSession.mockResolvedValue(null);

    const response = await authRouter.request(
      "/auth/unlink-account",
      {
        body: JSON.stringify({
          accountId: "google-account",
          providerId: "google",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }
    );

    expect(response.status).toBe(401);
    expect(authMocks.unlinkAccountSafely).not.toHaveBeenCalled();
  });

  it("uses the authenticated user and strict account selector", async () => {
    authMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    authMocks.unlinkAccountSafely.mockResolvedValue(undefined);

    const response = await authRouter.request(
      "/auth/unlink-account",
      {
        body: JSON.stringify({
          accountId: "google-account",
          providerId: "google",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }
    );

    expect(response.status).toBe(200);
    expect(authMocks.unlinkAccountSafely).toHaveBeenCalledWith({
      accountId: "google-account",
      providerId: "google",
      userId: "user-1",
    });
  });

  it("intercepts the native Better Auth path before the wildcard", async () => {
    authMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    authMocks.unlinkAccountSafely.mockResolvedValue(undefined);
    authMocks.authHandler.mockResolvedValue(
      Response.json({ wildcard: true }, { status: 418 })
    );

    const response = await app.request("/api/auth/unlink-account", {
      body: JSON.stringify({
        accountId: "google-account",
        providerId: "google",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(authMocks.authHandler).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ status: true });
  });

  it("intercepts path variants before the Better Auth wildcard", async () => {
    authMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    authMocks.unlinkAccountSafely.mockResolvedValue(undefined);
    authMocks.authHandler.mockResolvedValue(
      Response.json({ wildcard: true }, { status: 418 })
    );
    const paths = ["/api/auth/unlink-account/", "/api/auth//unlink-account"];

    const responses = await Promise.all(
      paths.map((path) =>
        app.request(path, {
          body: JSON.stringify({ providerId: "google" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        })
      )
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
    }
    expect(authMocks.authHandler).not.toHaveBeenCalled();
  });

  it("rejects injected fields", async () => {
    authMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });

    const response = await authRouter.request(
      "/auth/unlink-account",
      {
        body: JSON.stringify({
          accountId: "google-account",
          providerId: "google",
          userId: "another-user",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }
    );

    expect(response.status).toBe(400);
    expect(authMocks.unlinkAccountSafely).not.toHaveBeenCalled();
  });
});