import { describe, expect, it } from "vitest";

import { matchPermission } from "./rbac/matcher";

describe("platform permission matching", () => {
  it("matches exact, resource and global permissions", () => {
    expect(matchPermission("post.read", ["post.read"])).toBe(true);
    expect(matchPermission("post.update", ["post.*"])).toBe(true);
    expect(matchPermission("ticket.delete", ["*"])).toBe(true);
    expect(matchPermission("admin.read", ["post.*"])).toBe(false);
  });
});
