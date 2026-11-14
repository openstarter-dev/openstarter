import { grantCreditsForNewUser } from "@openstarter/billing-web";
import { logger } from "@openstarter/shared/logger";
import type { BetterAuthOptions } from "better-auth";
import type { OrganizationOptions } from "better-auth/plugins/organization";

import { grantRoleForNewUser } from "../rbac";

type DatabaseUserHooks = NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["user"]>;

type UserCreateAfterHook = NonNullable<NonNullable<DatabaseUserHooks["create"]>["after"]>;

type DeleteUserOptions = NonNullable<NonNullable<BetterAuthOptions["user"]>["deleteUser"]>;

type DeleteUserHooks = Pick<DeleteUserOptions, "beforeDelete" | "afterDelete">;

type OrganizationHooks = NonNullable<OrganizationOptions["organizationHooks"]>;

/**
 * Initialize role & welcome credits for newly created users from server environment config.
 * 注册完成后依环境变量配置为新用户初始化角色与欢迎积分。
 */
const runNewUserInitialization: UserCreateAfterHook = async (createdUser) => {
  const results = await Promise.allSettled([
    grantRoleForNewUser({ userId: createdUser.id }),
    grantCreditsForNewUser({
      userEmail: createdUser.email,
      userId: createdUser.id,
    }),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      logger.error(
        `[auth] new user initialization step failed for user ${createdUser.id}`,
        result.reason,
      );
    }
  }
};

const databaseUserHooks: DatabaseUserHooks = {
  create: {
    after: runNewUserInitialization,
  },
};

const deleteUser: DeleteUserHooks = {};

const organization: OrganizationHooks = {};

export const hooks = {
  deleteUser,
  organization,
  user: databaseUserHooks,
} as const;
