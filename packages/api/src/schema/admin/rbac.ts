// packages/api/src/schema/admin/rbac —— RBAC 管理端入参校验（modules/admin/rbac 路由复用）。
import { z } from "zod";

// ─── 入参校验 schema（zValidator） ───────────────────────────────────────────

export const createRoleBody = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

export const updateRoleBody = z.object({
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const rolePermissionsBody = z.object({
  permissionIds: z.array(z.string().min(1)),
});

export const createPermissionBody = z.object({
  code: z.string().min(1),
  resource: z.string().min(1),
  action: z.string().min(1),
  title: z.string().min(1),
});

export const updatePermissionBody = z.object({
  code: z.string().min(1).optional(),
  resource: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
});

export const assignUserRoleBody = z.object({
  roleId: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

export const userRoleParam = z.object({
  id: z.string().min(1),
  roleId: z.string().min(1),
});
