import { user } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { logger } from "@openstarter/shared/logger";
import { eq } from "drizzle-orm";

import { isKnownRole } from "./access";

export async function grantRoleForNewUser(params: {
  userId: string;
  configs: Record<string, string>;
}): Promise<void> {
  const { userId, configs } = params;

  if (configs.initial_role_enabled !== "true") {
    return;
  }

  const roleName = configs.initial_role_name?.trim();
  if (!roleName) {
    return;
  }

  if (!isKnownRole(roleName)) {
    logger.warn(`[auth] ignore unknown initial_role_name: ${roleName}`);
    return;
  }

  await db().update(user).set({ role: roleName }).where(eq(user.id, userId));
}
