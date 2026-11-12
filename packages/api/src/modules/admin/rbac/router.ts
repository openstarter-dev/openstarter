// packages/api/src/modules/admin/rbac —— RBAC 管理路由（角色 / 权限 / 用户-角色映射）。
//
// 路由只做三件事：挂载鉴权中间件、入参校验（zValidator）、把领域结果映射为
// HTTP 响应。鉴权与 RBAC 领域操作均在 ./service，本文件不直接访问 @openstarter/auth。

import { zValidator } from "@hono/zod-validator";
import { respData, respErr, respOk } from "@openstarter/shared";
import { Hono, type Context } from "hono";

import { requireAuth } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/rbac";
import { idParam } from "../../../schema";
import {
  assignUserRoleBody,
  createPermissionBody,
  createRoleBody,
  rolePermissionsBody,
  updatePermissionBody,
  updateRoleBody,
  userRoleParam,
} from "../../../schema/admin/rbac";
import {
  type RbacResult,
  assignPermissionsToRole,
  assignRoleToUser,
  createPermission,
  createRole,
  getPermissionsOfRole,
  getRolesOfUser,
  listPermissions,
  listRoles,
  removePermission,
  removeRole,
  removeRoleFromUser,
  updatePermission,
  updateRole,
} from "./service";

const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;
const PERMISSION_ADMIN = "admin.*";

/** 域结果 → HTTP：目标不存在映射 404，其余失败 400，成功统一包 respData。 */
function respond<T>(c: Context, result: RbacResult<T>) {
  if (!result.ok) {
    return c.json(respErr(result.message), result.notFound ? NOT_FOUND_STATUS : BAD_REQUEST_STATUS);
  }
  return c.json(respData(result.data));
}

/** 无返回值的写操作：成功即 respOk，失败 400。 */
function respondOk(c: Context, result: RbacResult<unknown>) {
  return result.ok ? c.json(respOk()) : c.json(respErr(result.message), BAD_REQUEST_STATUS);
}

export const rbacRouter = new Hono()
  .use(requireAuth)
  .use(requirePermission(PERMISSION_ADMIN))
  // ── 角色 CRUD（Role） ──────────────────────────────────────────────────────
  .get("/roles", async (c) => respond(c, await listRoles()))
  .post("/roles", zValidator("json", createRoleBody), async (c) =>
    respond(c, await createRole(c.req.valid("json"))),
  )
  .put(
    "/roles/:id",
    zValidator("param", idParam),
    zValidator("json", updateRoleBody),
    async (c) => {
      const { id } = c.req.valid("param");
      return respond(c, await updateRole(id, c.req.valid("json")));
    },
  )
  .delete("/roles/:id", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    return respondOk(c, await removeRole(id));
  })
  // ── 角色-权限映射（Role ↔ Permission） ───────────────────────────────────────
  .get("/roles/:id/permissions", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    return respond(c, await getPermissionsOfRole(id));
  })
  .put(
    "/roles/:id/permissions",
    zValidator("param", idParam),
    zValidator("json", rolePermissionsBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const { permissionIds } = c.req.valid("json");
      return respondOk(c, await assignPermissionsToRole(id, permissionIds));
    },
  )
  // ── 权限 CRUD（Permission） ──────────────────────────────────────────────────
  .get("/permissions", async (c) => respond(c, await listPermissions()))
  .post("/permissions", zValidator("json", createPermissionBody), async (c) =>
    respond(c, await createPermission(c.req.valid("json"))),
  )
  .put(
    "/permissions/:id",
    zValidator("param", idParam),
    zValidator("json", updatePermissionBody),
    async (c) => {
      const { id } = c.req.valid("param");
      return respond(c, await updatePermission(id, c.req.valid("json")));
    },
  )
  .delete("/permissions/:id", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    return respondOk(c, await removePermission(id));
  })
  // ── 用户-角色映射（User ↔ Role） ──────────────────────────────────────────────
  .get("/users/:id/roles", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    return respond(c, await getRolesOfUser(id));
  })
  .post(
    "/users/:id/roles",
    zValidator("param", idParam),
    zValidator("json", assignUserRoleBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const { roleId, expiresAt } = c.req.valid("json");
      return respondOk(c, await assignRoleToUser(id, roleId, expiresAt));
    },
  )
  .delete("/users/:id/roles/:roleId", zValidator("param", userRoleParam), async (c) => {
    const { id, roleId } = c.req.valid("param");
    return respondOk(c, await removeRoleFromUser(id, roleId));
  });
