import { grantCreditsForNewUser } from "@openstarter/billing-web";
import { getAllConfigs } from "@openstarter/shared/config";
import { logger } from "@openstarter/shared/logger";
import type { BetterAuthOptions } from "better-auth";
import type { OrganizationOptions } from "better-auth/plugins/organization";

import { grantRoleForNewUser } from "../rbac";

type DatabaseUserHooks = NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["user"]>;

type UserCreateAfterHook = NonNullable<NonNullable<DatabaseUserHooks["create"]>["after"]>;

type CreatedUser = Parameters<UserCreateAfterHook>[0];

type DeleteUserOptions = NonNullable<NonNullable<BetterAuthOptions["user"]>["deleteUser"]>;

type DeleteUserHooks = Pick<DeleteUserOptions, "beforeDelete" | "afterDelete">;

type OrganizationHooks = NonNullable<OrganizationOptions["organizationHooks"]>;

function initializeNewUserRole(userId: string, configs: Record<string, string>): Promise<void> {
  return grantRoleForNewUser({ configs, userId });
}

async function initializeNewUserCredits(
  createdUser: CreatedUser,
  configs: Record<string, string>,
): Promise<void> {
  await grantCreditsForNewUser({
    configs,
    userEmail: createdUser.email,
    userId: createdUser.id,
  });
}

const runNewUserInitialization: UserCreateAfterHook = async (createdUser) => {
  let configs: Record<string, string>;
  try {
    configs = await getAllConfigs();
  } catch (error) {
    logger.error(
      `[auth] new user initialization: failed to read configs for user ${createdUser.id}`,
      error,
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
