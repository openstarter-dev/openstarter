// packages/auth/src/rbac —— 授权子路径（@openstarter/auth 的 `./rbac`）。
//
// 两个**互不覆盖**的作用域：
//   1. 团队作用域：`ac` / `roles`，仅供 better-auth organization 插件做成员与团队许可判定；
//   2. 平台作用域：`platformAc` / `platformRoles`（见 ./access），由 admin 插件 +
//      `auth.api.userHasPermission` / `adminClient.checkRolePermission` 使用，
//      数据载体是 `user.role` 单字段。
//
// 平台侧不再自建匹配器：语句与角色都由 better-auth access control 定义，
// 判定走它的 `authorize()`，两侧（服务端 / 浏览器）共用同一组对象。

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
 */
export const ac = createAccessControl(defaultStatements);

/** 团队角色 → 默认许可（owner / admin / member），复用组织插件内置定义。 */
export const roles = {
  owner: ownerAc,
  admin: adminAc,
  member: memberAc,
} as const;

export * from "./access";
export * from "./service";
