// packages/api/src/routes/admin —— 平台级 RBAC 管理路由（R7.1/R7.5/R7.6）。
//
// 角色 / 权限 / 角色-权限映射 / 用户-角色映射的管理端点，均属平台级**管理操作**：先经
// `requireAuth`（会话或有效 API Key）解析主体，再由 `requirePermission(admin.*)` 依**通配符 RBAC**
// 判定权限（授予 `admin.*` 或 `*` 即通行，缺失返回 403），与 better-auth `organization` 解耦。
// 入参经 `zValidator` 校验；资源不存在返回结构化 404；服务抛错转 400。
//
// 端点：
//   - GET    /api/admin/roles                      列出全部启用中的角色；
//   - POST   /api/admin/roles                      创建角色；
//   - PUT    /api/admin/roles/:id                  更新角色（partial）；
//   - DELETE /api/admin/roles/:id                  软删除角色（status=inactive）；
//   - GET    /api/admin/roles/:id/permissions      读取角色权限 id 列表；
//   - PUT    /api/admin/roles/:id/permissions      覆盖式设置角色权限集合；
//   - GET    /api/admin/permissions                列出全部权限；
//   - POST   /api/admin/permissions                创建权限；
//   - PUT    /api/admin/permissions/:id            更新权限（partial）；
//   - DELETE /api/admin/permissions/:id            删除权限；
//   - GET    /api/admin/users/:id/roles            读取用户角色（含到期时间与角色元信息）；
//   - POST   /api/admin/users/:id/roles            为用户分配角色（可选到期时间）；
//   - DELETE /api/admin/users/:id/roles/:roleId    移除用户的某角色。

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

import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;

// 权限码（`resource.action`）。通配符 RBAC 约定：授予 `admin.*` 或 `*` 即通行——即
// 「平台管理权限」。RBAC 管理自身亦归属 `admin` 资源域，与 tickets 的 `ticket.*` 同构。
const PERMISSION_ADMIN = "admin.*";

// ─── 入参校验 schema（zValidator） ───────────────────────────────────────────

const idParam = z.object({ id: z.string().min(1) });

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
  // 允许空数组（清空角色权限）；数组元素为权限 id 字符串。
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
  // ISO 8601 字符串，校验后转 Date；省略表示永不过期。
  expiresAt: z.string().datetime().optional(),
});

const userRoleParam = z.object({
  id: z.string().min(1),
  roleId: z.string().min(1),
});

export const adminRoute = new Hono()

  // ── 角色 CRUD（Role） ──────────────────────────────────────────────────────
  .get(
    "/api/admin/roles",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    async (c) => {
      const roles: Role[] = await getRoles();
      return c.json(respData(roles));
    }
  )
  .post(
    "/api/admin/roles",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("json", createRoleBody),
    async (c) => {
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
    }
  )
  .put(
    "/api/admin/roles/:id",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("param", idParam),
    zValidator("json", updateRoleBody),
    async (c) => {
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
    }
  )
  .delete(
    "/api/admin/roles/:id",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("param", idParam),
    async (c) => {
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
    }
  )

  // ── 角色-权限映射（Role ↔ Permission） ───────────────────────────────────────
  .get(
    "/api/admin/roles/:id/permissions",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("param", idParam),
    async (c) => {
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
    }
  )
  .put(
    "/api/admin/roles/:id/permissions",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("param", idParam),
    zValidator("json", rolePermissionsBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const { permissionIds } = c.req.valid("json");
      try {
        await assignPermissionsToRole(id, permissionIds);
        return c.json(respOk());
      } catch (e) {
        return c.json(
          respErr(
            e instanceof Error ? e.message : "assign role permissions failed"
          ),
          BAD_REQUEST_STATUS
        );
      }
    }
  )

  // ── 权限 CRUD（Permission） ──────────────────────────────────────────────────
  .get(
    "/api/admin/permissions",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    async (c) => {
      const permissions: Permission[] = await getPermissions();
      return c.json(respData(permissions));
    }
  )
  .post(
    "/api/admin/permissions",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("json", createPermissionBody),
    async (c) => {
      const body = c.req.valid("json");
      try {
        const created = await createPermission({
          code: body.code,
          resource: body.resource,
          action: body.action,
          title: body.title,
        });
        if (!created) {
          return c.json(
            respErr("permission not created"),
            BAD_REQUEST_STATUS
          );
        }
        return c.json(respData(created));
      } catch (e) {
        return c.json(
          respErr(e instanceof Error ? e.message : "create permission failed"),
          BAD_REQUEST_STATUS
        );
      }
    }
  )
  .put(
    "/api/admin/permissions/:id",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("param", idParam),
    zValidator("json", updatePermissionBody),
    async (c) => {
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
    }
  )
  .delete(
    "/api/admin/permissions/:id",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("param", idParam),
    async (c) => {
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
    }
  )

  // ── 用户-角色映射（User ↔ Role） ─────────────────────────────────────────────
  .get(
    "/api/admin/users/:id/roles",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("param", idParam),
    async (c) => {
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
    }
  )
  .post(
    "/api/admin/users/:id/roles",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("param", idParam),
    zValidator("json", assignUserRoleBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const { roleId, expiresAt } = c.req.valid("json");
      try {
        await assignRoleToUser(
          id,
          roleId,
          expiresAt ? new Date(expiresAt) : undefined
        );
        return c.json(respOk());
      } catch (e) {
        return c.json(
          respErr(e instanceof Error ? e.message : "assign role to user failed"),
          BAD_REQUEST_STATUS
        );
      }
    }
  )
  .delete(
    "/api/admin/users/:id/roles/:roleId",
    requireAuth,
    requirePermission(PERMISSION_ADMIN),
    zValidator("param", userRoleParam),
    async (c) => {
      const { id, roleId } = c.req.valid("param");
      try {
        await removeRoleFromUser(id, roleId);
        return c.json(respOk());
      } catch (e) {
        return c.json(
          respErr(e instanceof Error ? e.message : "remove role from user failed"),
          BAD_REQUEST_STATUS
        );
      }
    }
  );
