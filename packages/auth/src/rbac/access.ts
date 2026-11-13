import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc as pluginAdminAc,
  defaultStatements as pluginDefaultStatements,
  userAc as pluginUserAc,
} from "better-auth/plugins/admin/access";

const PLATFORM_STATEMENTS = {
  ...pluginDefaultStatements,
  admin: ["*"],
  post: ["read", "create", "update", "delete"],
  taxonomy: ["read", "create", "update", "delete"],
  ticket: ["read", "reply", "update"],
  analytics: ["read"],
} as const;

export const platformAc = createAccessControl(PLATFORM_STATEMENTS);

export const PlatformRole = {
  ADMIN: "admin",
  USER: "user",
} as const;

export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export const ADMIN_ROLES: readonly PlatformRole[] = [PlatformRole.ADMIN];

export const DEFAULT_ROLE: PlatformRole = PlatformRole.USER;

export const platformRoles = {
  admin: platformAc.newRole({
    ...pluginAdminAc.statements,
    admin: ["*"],
    post: ["read", "create", "update", "delete"],
    taxonomy: ["read", "create", "update", "delete"],
    ticket: ["read", "reply", "update"],
    analytics: ["read"],
  }),
  user: platformAc.newRole({
    ...pluginUserAc.statements,
  }),
};

export function isKnownRole(role: string): role is PlatformRole {
  return Object.hasOwn(platformRoles, role);
}

export function toPermissionRequest(code: string): Record<string, string[]> {
  const separator = code.indexOf(".");
  if (separator <= 0 || separator === code.length - 1) {
    return { [code]: [] };
  }
  return { [code.slice(0, separator)]: [code.slice(separator + 1)] };
}
