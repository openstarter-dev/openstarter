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
// （`grant*ForNewUser` 内部判定 `initial_role_enabled` / `initial_credits_enabled`）。并发
// 幂等由数据库强约束保证：`user_role(user_id, role_id)` 唯一，welcome credit 使用稳定
// `transaction_no`；授予失败经 `@openstarter/shared/logger` 记录且**不中断用户创建主流程**。
//
// 依赖方向合法：auth(L3) → billing(L2)（`grantCreditsForNewUser`）、auth 内 `./rbac`
// （`grantRoleForNewUser`）；billing 不反向依赖 auth，无 import 环。

import { grantCreditsForNewUser } from "@openstarter/billing-web";
import { getAllConfigs } from "@openstarter/shared/config";
import { logger } from "@openstarter/shared/logger";
import type { BetterAuthOptions } from "better-auth";
import type { OrganizationOptions } from "better-auth/plugins/organization";

import { grantRoleForNewUser } from "../rbac";

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
 * 为新用户授予初始角色。并发幂等由 `user_role(user_id, role_id)` 唯一约束与原子 upsert
 * 保证，避免“先查再写”的竞态窗口。
 */
function initializeNewUserRole(
  userId: string,
  configs: Record<string, string>
): Promise<void> {
  return grantRoleForNewUser({ configs, userId });
}

/**
 * 为新用户授予初始积分。稳定交易号 `welcome-credit:<userId>` 与
 * `credit.transaction_no` 唯一约束共同保证并发调用只落一笔。
 */
async function initializeNewUserCredits(
  createdUser: CreatedUser,
  configs: Record<string, string>
): Promise<void> {
  await grantCreditsForNewUser({
    configs,
    userEmail: createdUser.email,
    userId: createdUser.id,
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
const runNewUserInitialization: UserCreateAfterHook = async (createdUser) => {
  let configs: Record<string, string>;
  try {
    configs = await getAllConfigs();
  } catch (error) {
    logger.error(
      `[auth] new user initialization: failed to read configs for user ${createdUser.id}`,
      error
    );
    return;
  }

  const results = await Promise.allSettled([
    initializeNewUserRole(createdUser.id, configs),
    initializeNewUserCredits(createdUser, configs),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      logger.error(
        `[auth] new user initialization step failed for user ${createdUser.id}`,
        result.reason
      );
    }
  }
};

// 用户数据库钩子：结构 + 新用户初始化（create.after）。update / delete 暂无叠加逻辑。
const databaseUserHooks: DatabaseUserHooks = {
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
  deleteUser,
  organization,
  user: databaseUserHooks,
} as const;
