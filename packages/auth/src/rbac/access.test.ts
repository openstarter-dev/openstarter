import { describe, expect, it } from "vitest";

import { PlatformRole, platformRoles, toPermissionRequest } from "./access";

const authorize = (role: PlatformRole, code: string) =>
  platformRoles[role].authorize(toPermissionRequest(code)).success;

describe("toPermissionRequest", () => {
  it("splits resource.action codes", () => {
    expect(toPermissionRequest("post.read")).toEqual({ post: ["read"] });
    expect(toPermissionRequest("admin.*")).toEqual({ admin: ["*"] });
  });

  it("keeps dots in the action segment", () => {
    expect(toPermissionRequest("post.import.csv")).toEqual({ post: ["import.csv"] });
  });
});

describe("platformRoles", () => {
  it("grants admins every business action and the admin console entry", () => {
    expect(authorize(PlatformRole.ADMIN, "admin.*")).toBe(true);
    expect(authorize(PlatformRole.ADMIN, "post.create")).toBe(true);
    expect(authorize(PlatformRole.ADMIN, "ticket.reply")).toBe(true);
    expect(authorize(PlatformRole.ADMIN, "analytics.read")).toBe(true);
  });

  it("grants admins the plugin's own user/session actions", () => {
    expect(platformRoles[PlatformRole.ADMIN].authorize({ user: ["set-role"] }).success).toBe(true);
    expect(platformRoles[PlatformRole.ADMIN].authorize({ session: ["list"] }).success).toBe(true);
  });

  it("denies every business action to regular users", () => {
    expect(authorize(PlatformRole.USER, "admin.*")).toBe(false);
    expect(authorize(PlatformRole.USER, "post.read")).toBe(false);
  });

  it("does not treat the admin wildcard as a prefix match", () => {
    expect(authorize(PlatformRole.ADMIN, "admin.read")).toBe(false);
    expect(authorize(PlatformRole.USER, "post.*")).toBe(false);
  });
});
