import {
  assignPermissionsToRole,
  assignRoleToUser,
  createPermission,
  createRole,
  deletePermission,
  deleteRole,
  getPermissions,
  getRolePermissions,
  getRoles,
  getUserRoles,
  removeRoleFromUser,
  updatePermission,
  updateRole,
} from "@openstarter/auth";
import type { Permission, Role } from "@openstarter/db/schema";
import { respData, respErr, respOk } from "@openstarter/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/rbac";
import { idParam } from "../../../schema";

const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;
const PERMISSION_ADMIN = "admin.*";

// ─── 入参校验 schema（zValidator） ───────────────────────────────────────────

const createRoleBody = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

const updateRoleBody = z.object({
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

const rolePermissionsBody = z.object({
  permissionIds: z.array(z.string().min(1)),
});

const createPermissionBody = z.object({
  code: z.string().min(1),
  resource: z.string().min(1),
  action: z.string().min(1),
  title: z.string().min(1),
});

const updatePermissionBody = z.object({
  code: z.string().min(1).optional(),
  resource: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
});

const assignUserRoleBody = z.object({
  roleId: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

const userRoleParam = z.object({
  id: z.string().min(1),
  roleId: z.string().min(1),
});

export const rbacRouter = new Hono()
  .use(requireAuth)
  .use(requirePermission(PERMISSION_ADMIN))
  // ── 角色 CRUD（Role） ──────────────────────────────────────────────────────
  .get("/roles", async (c) => {
    const roles: Role[] = await getRoles();
    return c.json(respData(roles));
  })
  .post("/roles", zValidator("json", createRoleBody), async (c) => {
    const body = c.req.valid("json");
    try {
      const created = await createRole({
        name: body.name,
        title: body.title,
        description: body.description,
      });
      if (!created) {
        return c.json(respErr("role not created"), BAD_REQUEST_STATUS);
      }
      return c.json(respData(created));
    } catch (e) {
      return c.json(
        respErr(e instanceof Error ? e.message : "create role failed"),
        BAD_REQUEST_STATUS
      );
    }
  })
  .put("/roles/:id", zValidator("param", idParam), zValidator("json", updateRoleBody), async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    try {
      const updated = await updateRole(id, body);
      if (!updated) {
        return c.json(respErr("role not found"), NOT_FOUND_STATUS);
      }
      return c.json(respData(updated));
    } catch (e) {
      return c.json(
        respErr(e instanceof Error ? e.message : "update role failed"),
        BAD_REQUEST_STATUS
      );
    }
  })
  .delete("/roles/:id", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    try {
      await deleteRole(id);
      return c.json(respOk());
    } catch (e) {
      return c.json(
        respErr(e instanceof Error ? e.message : "delete role failed"),
        BAD_REQUEST_STATUS
      );
    }
  })
  // ── 角色-权限映射（Role ↔ Permission） ───────────────────────────────────────
  .get("/roles/:id/permissions", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    try {
      const permissions = await getRolePermissions(id);
      return c.json(respData(permissions));
    } catch (e) {
      return c.json(
        respErr(e instanceof Error ? e.message : "get role permissions failed"),
        BAD_REQUEST_STATUS
      );
    }
  })
  .put("/roles/:id/permissions", zValidator("param", idParam), zValidator("json", rolePermissionsBody), async (c) => {
    const { id } = c.req.valid("param");
    const { permissionIds } = c.req.valid("json");
    try {
      await assignPermissionsToRole(id, permissionIds);
      return c.json(respOk());
    } catch (e) {
      return c.json(
        respErr(e instanceof Error ? e.message : "assign permissions failed"),
        BAD_REQUEST_STATUS
      );
    }
  })
  // ── 权限 CRUD（Permission） ──────────────────────────────────────────────────
  .get("/permissions", async (c) => {
    const permissions: Permission[] = await getPermissions();
    return c.json(respData(permissions));
  })
  .post("/permissions", zValidator("json", createPermissionBody), async (c) => {
    const body = c.req.valid("json");
    try {
      const created = await createPermission({
        code: body.code,
        resource: body.resource,
        action: body.action,
        title: body.title,
      });
      if (!created) {
        return c.json(respErr("permission not created"), BAD_REQUEST_STATUS);
      }
      return c.json(respData(created));
    } catch (e) {
      return c.json(
        respErr(e instanceof Error ? e.message : "create permission failed"),
        BAD_REQUEST_STATUS
      );
    }
  })
  .put("/permissions/:id", zValidator("param", idParam), zValidator("json", updatePermissionBody), async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    try {
      const updated = await updatePermission(id, body);
      if (!updated) {
        return c.json(respErr("permission not found"), NOT_FOUND_STATUS);
      }
      return c.json(respData(updated));
    } catch (e) {
      return c.json(
        respErr(e instanceof Error ? e.message : "update permission failed"),
        BAD_REQUEST_STATUS
      );
    }
  })
  .delete("/permissions/:id", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    try {
      await deletePermission(id);
      return c.json(respOk());
    } catch (e) {
      return c.json(
        respErr(e instanceof Error ? e.message : "delete permission failed"),
        BAD_REQUEST_STATUS
      );
    }
  })
  // ── 用户-角色映射（User ↔ Role） ──────────────────────────────────────────────
  .get("/users/:id/roles", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    try {
      const roles = await getUserRoles(id);
      return c.json(respData(roles));
    } catch (e) {
      return c.json(
        respErr(e instanceof Error ? e.message : "get user roles failed"),
        BAD_REQUEST_STATUS
      );
    }
  })
  .post("/users/:id/roles", zValidator("param", idParam), zValidator("json", assignUserRoleBody), async (c) => {
    const { id } = c.req.valid("param");
    const { roleId, expiresAt } = c.req.valid("json");
    try {
      await assignRoleToUser(id, roleId, expiresAt ? new Date(expiresAt) : undefined);
      return c.json(respOk());
    } catch (e) {
      return c.json(
        respErr(e instanceof Error ? e.message : "assign role failed"),
        BAD_REQUEST_STATUS
      );
    }
  })
  .delete("/users/:id/roles/:roleId", zValidator("param", userRoleParam), async (c) => {
    const { id, roleId } = c.req.valid("param");
    try {
      await removeRoleFromUser(id, roleId);
      return c.json(respOk());
    } catch (e) {
      return c.json(
        respErr(e instanceof Error ? e.message : "remove role failed"),
        BAD_REQUEST_STATUS
      );
    }
  });