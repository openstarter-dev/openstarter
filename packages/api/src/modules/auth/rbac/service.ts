import { user } from "../../../db/schema";
import { db } from "../../../db/server";
import { logger } from "@openstarter/shared/logger";
import { eq } from "drizzle-orm";

import { readBooleanEnv, readEnv } from "../lib/runtime-env";
import { isKnownRole } from "@openstarter/auth/rbac/access";

export async function grantRoleForNewUser(params: { userId: string }): Promise<void> {
  const { userId } = params;

  if (!readBooleanEnv("INITIAL_ROLE_ENABLED", false)) {
    return;
  }

  const roleName = readEnv("INITIAL_ROLE_NAME");
  if (!roleName) {
    return;
  }

  if (!isKnownRole(roleName)) {
    logger.warn(`[auth] ignore unknown INITIAL_ROLE_NAME: ${roleName}`);
    return;
  }

  await db().update(user).set({ role: roleName }).where(eq(user.id, userId));
}
