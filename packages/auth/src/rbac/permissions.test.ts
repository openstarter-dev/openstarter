import { describe, expect, it } from "vitest";

import {
  hasAdminRole,
  isKnownRole,
  parseRoles,
  PlatformRole,
  resolvePermissions,
} from "./permissions";

describe("parseRoles", () => {
  it("splits comma separated roles and trims blanks", () => {
    expect(parseRoles(" admin , user ,, ")).toEqual(["admin", "user"]);
  });

  it("returns an empty list for missing values", () => {
    expect(parseRoles(null)).toEqual([]);
    expect(parseRoles(undefined)).toEqual([]);
    expect(parseRoles("")).toEqual([]);
  });

  it("dedupes repeated roles", () => {
    expect(parseRoles("admin,admin")).toEqual(["admin"]);
  });
});

describe("resolvePermissions", () => {
  it("grants every code to admins via the global wildcard", () => {
    expect(resolvePermissions("admin")).toEqual(["*"]);
  });

  it("grants nothing to regular users", () => {
    expect(resolvePermissions("user")).toEqual([]);
  });

  it("unions permissions of multiple roles", () => {
    expect(resolvePermissions("user,admin")).toEqual(["*"]);
  });

  it("ignores unknown role names instead of failing open", () => {
    expect(resolvePermissions("nope")).toEqual([]);
    expect(resolvePermissions("nope,admin")).toEqual(["*"]);
  });
});

describe("isKnownRole / hasAdminRole", () => {
  it("recognises only code-defined roles", () => {
    expect(isKnownRole(PlatformRole.ADMIN)).toBe(true);
    expect(isKnownRole("editor")).toBe(false);
  });

  it("detects an admin role inside a multi-role value", () => {
    expect(hasAdminRole("user,admin")).toBe(true);
    expect(hasAdminRole("user")).toBe(false);
    expect(hasAdminRole(null)).toBe(false);
  });
});
