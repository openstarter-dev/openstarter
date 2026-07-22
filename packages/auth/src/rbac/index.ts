// packages/auth/src/rbac —— 授权子路径（@openstarter/auth 的 `./rbac`）。
//
// 本任务（1.3）仅落位 **团队作用域** 的 organization 访问控制 `ac` / `roles`，
// 供 `server.ts` 中 `organization({ ac, roles })` 装配（better-auth organization 插件）。
// 直接沿用 better-auth 组织插件的默认语句与默认角色，以恢复 TurboStarter 既有的
// 组织/团队/成员许可语义（不裁剪）。
//
// 说明（作用域边界，R7.7 / R7.8，见 design.md「RBAC 与 organization 插件的作用域边界」）：
//   - 此处的 `ac` / `roles` **仅**服务于 organization 插件内部的团队协作语义；
//   - **平台级授权** 唯一依据 ShipAny 通配符 RBAC（`matchPermission` /
//     `getUserPermissionCodes` / `hasPermission`），由阶段 1 任务 9 在同一 `./rbac`
//     子路径下补齐；二者数据面相互独立、互不覆盖。此任务不实现通配符 RBAC。

import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * 团队作用域访问控制实例，供 better-auth `organization` 插件做成员许可判定。
 *
 * 采用组织插件的默认语句集（organization / member / invitation / team / ac 五类资源），
 * 由本包持有一个可后续扩展自定义资源的 `AccessControl` 实例，替代直接透传默认实例。
 *
 * 注意：此 `ac` 不参与平台级授权（平台授权唯一依据通配符 RBAC，见任务 9 / 12）。
 */
export const ac = createAccessControl(defaultStatements);

/**
 * 组织团队角色到默认许可的映射（owner / admin / member）。
 *
 * 复用 better-auth 组织插件的默认角色定义，保留既有团队协作许可语义。
 */
export const roles = {
  owner: ownerAc,
  admin: adminAc,
  member: memberAc,
} as const;

// ─── 平台作用域通配符 RBAC（阶段 1 任务 9）──────────────────────────────────────
//
// 在同一 `./rbac` 子路径下补齐平台级授权：纯函数通配符匹配器（matcher）与
// DB 支撑的角色/权限 CRUD 及权限判定（service）。作为平台授权的唯一依据，
// 与上方团队作用域的 `ac`/`roles` 数据面独立、互不覆盖（R7.7/R7.8）。
export * from "./matcher";
export * from "./service";
