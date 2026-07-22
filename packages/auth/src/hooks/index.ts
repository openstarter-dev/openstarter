// packages/auth/src/hooks —— better-auth 生命周期钩子落位（@openstarter/auth/server 经
// `server.ts` 尾部 `export * from "./hooks"` 暴露）。
//
// 现有 `server.ts` 引用：
//   - `databaseHooks: { user: hooks.user }`                  → hooks.user
//   - `user.deleteUser: { ..., ...hooks.deleteUser }`        → hooks.deleteUser
//   - `organization({ ..., organizationHooks: hooks.organization })` → hooks.organization
//
// 各钩子的类型直接从 better-auth 选项类型派生，保证与 `server.ts` 装配点完全一致。
//
// 新用户初始化（任务 15.1，R5.5 / R7.6 / R13.7）：`hooks.user.create.after` 在**保留**既有
// 钩子结构的基础上**叠加**初始角色与初始积分授予——better-auth 对 OAuth 首登与邮箱注册
// 两条首次创建路径均触发 `create.after`，故两者一并覆盖。两项授予均受 Config 开关控制
// （`grant*ForNewUser` 内部判定 `initial_role_enabled` / `initial_credits_enabled`），且对
// 同一用户幂等：`create.after` 每个用户仅在创建时触发一次，此外授予前检查该用户是否已有
// 角色 / 积分记录，已有则跳过，避免重复授予（积分尤其不可重复叠加）。授予为异步副作用，
// 其失败经 `@openstarter/shared/logger` 记录且**不中断用户创建主流程**（叠加而非裁剪）。
//
// 依赖方向合法：auth(L3) → billing(L2)（`grantCreditsForNewUser`）、auth 内 `./rbac`
// （`grantRoleForNewUser`）；billing 不反向依赖 auth，无 import 环。

import type { BetterAuthOptions } from "better-auth";
import type { OrganizationOptions } from "better-auth/plugins/organization";

import { getHistory, grantCreditsForNewUser } from "@openstarter/billing";
import { getAllConfigs } from "@openstarter/shared/config";
import { logger } from "@openstarter/shared/logger";

import { getUserRoles, grantRoleForNewUser } from "../rbac";

/** `databaseHooks.user`：用户表的 create / update / delete 生命周期钩子。 */
type DatabaseUserHooks = NonNullable<
  NonNullable<BetterAuthOptions["databaseHooks"]>["user"]
>;

/**
 * `databaseHooks.user.create.after` 回调类型，直接从 better-auth 选项派生，
 * 保证签名 `(user, context) => Promise<void>` 与装配点契约一致。
 */
type UserCreateAfterHook = NonNullable<
  NonNullable<DatabaseUserHooks["create"]>["after"]
>;

/** `create.after` 接收的已创建用户对象类型（含 `id` / `email` 等）。 */
type CreatedUser = Parameters<UserCreateAfterHook>[0];

/** `user.deleteUser` 完整配置（含 enabled / 验证发送 / 生命周期回调等）。 */
type DeleteUserOptions = NonNullable<
  NonNullable<BetterAuthOptions["user"]>["deleteUser"]
>;

/**
 * `user.deleteUser` 的“钩子片段”：仅生命周期回调。
 * `enabled` 与 `sendDeleteAccountVerification` 由 `server.ts` 直接装配，此片段经
 * `...hooks.deleteUser` 并入，避免覆盖那两项配置。
 */
type DeleteUserHooks = Pick<DeleteUserOptions, "beforeDelete" | "afterDelete">;

/** `organization` 插件的组织 / 团队 / 成员 / 邀请生命周期钩子（organizationHooks）。 */
type OrganizationHooks = NonNullable<OrganizationOptions["organizationHooks"]>;

// ─── 新用户初始化（New user initialization，R5.5 / R7.6 / R13.7）──────────────────

/**
 * 为新用户授予初始角色（受 Config 开关控制且幂等）。
 *
 * 幂等保护：新用户在 `create.after` 时应无任何角色；若已存在角色记录则视为已初始化并跳过。
 * 是否授予及授予何角色由 {@link grantRoleForNewUser} 依 Config
 * （`initial_role_enabled` / `initial_role_name`）内部判定。
 */
async function initializeNewUserRole(
  userId: string,
  configs: Record<string, string>
): Promise<void> {
  const existingRoles = await getUserRoles(userId);
  if (existingRoles.length > 0) {
    return;
  }
  await grantRoleForNewUser({ userId, configs });
}

/**
 * 为新用户授予初始积分（受 Config 开关控制且幂等）。
 *
 * 幂等保护：新用户在 `create.after` 时应无任何积分流水；若已存在积分记录则视为已初始化并
 * 跳过，避免重复叠加（积分不可重复授予）。是否授予及数量 / 有效期由
 * {@link grantCreditsForNewUser} 依 Config（`initial_credits_*`）内部判定。
 */
async function initializeNewUserCredits(
  user: CreatedUser,
  configs: Record<string, string>
): Promise<void> {
  const existingCredits = await getHistory(user.id, { limit: 1 });
  if (existingCredits.length > 0) {
    return;
  }
  await grantCreditsForNewUser({
    userId: user.id,
    userEmail: user.email,
    configs,
  });
}

/**
 * `databaseHooks.user.create.after`：新用户首次创建（OAuth 与邮箱注册均触发）后，
 * 叠加初始角色与初始积分授予。
 *
 * 容错姿态（叠加而非裁剪）：读取 Config 或任一授予失败都经 logger 记录，且**不抛出**——
 * 用户此时已创建成功，初始化属异步副作用，其失败不应中断用户创建主流程。角色与积分
 * 相互独立、并行执行（`allSettled`），单项失败不影响另一项。
 */
const runNewUserInitialization: UserCreateAfterHook = async (user) => {
  let configs: Record<string, string>;
  try {
    configs = await getAllConfigs();
  } catch (error) {
    logger.error(
      `[auth] new user initialization: failed to read configs for user ${user.id}`,
      error
    );
    return;
  }

  const results = await Promise.allSettled([
    initializeNewUserRole(user.id, configs),
    initializeNewUserCredits(user, configs),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      logger.error(
        `[auth] new user initialization step failed for user ${user.id}`,
        result.reason
      );
    }
  }
};

// 用户数据库钩子：结构 + 新用户初始化（create.after）。update / delete 暂无叠加逻辑。
const user: DatabaseUserHooks = {
  create: {
    after: runNewUserInitialization,
  },
};

// 删除账号生命周期钩子片段：预留 beforeDelete / afterDelete 落位位置（当前无叠加逻辑）。
const deleteUser: DeleteUserHooks = {};

// 组织生命周期钩子：现仅落位结构，保留组织协作语义的扩展位置。
const organization: OrganizationHooks = {};

/**
 * 认证生命周期钩子集合，供 `server.ts` 装配 better-auth。
 */
export const hooks = {
  user,
  deleteUser,
  organization,
} as const;
