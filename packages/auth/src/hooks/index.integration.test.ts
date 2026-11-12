import { credit, user } from "@openstarter/db/schema";
import type { Database } from "@openstarter/db/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeAuthTestDatabase,
  createAuthTestDatabase,
  resetAuthTestDatabase,
} from "../test/auth-test-database";
import { hooks } from "./index";

const FIXED_NOW = new Date("2026-07-24T00:00:00.000Z");
const INITIAL_CREDITS = 120;
const INITIAL_ROLE = "admin";

const state = vi.hoisted(() => ({
  configs: {} as Record<string, string>,
  database: undefined as Database | undefined,
  idSequence: 0,
  snowSequence: 0,
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("Test database is not initialized");
      }
      return state.database;
    },
  };
});

vi.mock("@openstarter/shared/config", () => ({
  getAllConfigs: () => Promise.resolve({ ...state.configs }),
}));

vi.mock("@openstarter/shared/id", () => ({
  getSnowId: () => {
    state.snowSequence += 1;
    return `test-transaction-${state.snowSequence}`;
  },
  getUuid: () => {
    state.idSequence += 1;
    return `test-id-${state.idSequence}`;
  },
}));

const createdUser = {
  createdAt: FIXED_NOW,
  email: "new-user@example.com",
  emailVerified: true,
  id: "new-user",
  image: null,
  name: "New User",
  updatedAt: FIXED_NOW,
};

const seedCreatedUser = async () => {
  if (!state.database) {
    throw new Error("Test database is not initialized");
  }
  await state.database.insert(user).values(createdUser);
};

const readRole = async (): Promise<string | null | undefined> => {
  if (!state.database) {
    throw new Error("Test database is not initialized");
  }
  const [row] = await state.database
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, createdUser.id))
    .limit(1);
  return row?.role;
};

const invokeCreateAfterHook = async () => {
  await hooks.user.create?.after?.(createdUser, null);
};

beforeAll(async () => {
  state.database = await createAuthTestDatabase("new-user-hooks");
});

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  state.configs = {};
  state.idSequence = 0;
  state.snowSequence = 0;
  if (state.database) {
    await resetAuthTestDatabase(state.database);
  }
  await seedCreatedUser();
});

afterAll(() => {
  vi.useRealTimers();
  if (state.database) {
    closeAuthTestDatabase(state.database);
  }
});

describe("Task 15.2 new user initialization hook", () => {
  it("grants the configured initial role and credits after user creation", async () => {
    state.configs = {
      initial_credits_amount: String(INITIAL_CREDITS),
      initial_credits_description: "Welcome credits",
      initial_credits_enabled: "true",
      initial_credits_valid_days: "30",
      initial_role_enabled: "true",
      initial_role_name: INITIAL_ROLE,
    };

    await invokeCreateAfterHook();

    if (!state.database) {
      throw new Error("Test database is not initialized");
    }
    const grantedCredits = await state.database.select().from(credit);
    expect(await readRole()).toBe(INITIAL_ROLE);
    expect(grantedCredits).toMatchObject([
      {
        credits: INITIAL_CREDITS,
        description: "Welcome credits",
        remainingCredits: INITIAL_CREDITS,
        transactionType: "grant",
        userEmail: createdUser.email,
        userId: createdUser.id,
      },
    ]);
    expect(grantedCredits.at(0)?.expiresAt).toEqual(new Date("2026-08-23T00:00:00.000Z"));
  });

  it("ignores role names that are not defined in code", async () => {
    state.configs = {
      initial_role_enabled: "true",
      initial_role_name: "member",
    };

    await invokeCreateAfterHook();

    // 列默认值为 user（admin 插件的 defaultRole），未知角色名不会写入。
    expect(await readRole()).toBe("user");
  });

  it("keeps role and credit grants idempotent when the hook repeats", async () => {
    state.configs = {
      initial_credits_amount: String(INITIAL_CREDITS),
      initial_credits_enabled: "true",
      initial_credits_valid_days: "0",
      initial_role_enabled: "true",
      initial_role_name: INITIAL_ROLE,
    };

    await invokeCreateAfterHook();
    await invokeCreateAfterHook();

    if (!state.database) {
      throw new Error("Test database is not initialized");
    }
    expect(await readRole()).toBe(INITIAL_ROLE);
    expect(await state.database.select().from(credit)).toHaveLength(1);
  });

  it("grants exactly one welcome credit under concurrent hooks", async () => {
    state.configs = {
      initial_credits_amount: String(INITIAL_CREDITS),
      initial_credits_enabled: "true",
      initial_credits_valid_days: "0",
      initial_role_enabled: "true",
      initial_role_name: INITIAL_ROLE,
    };

    await Promise.all(Array.from({ length: 8 }, () => invokeCreateAfterHook()));

    if (!state.database) {
      throw new Error("Test database is not initialized");
    }
    const grantedCredits = await state.database.select().from(credit);
    expect(await readRole()).toBe(INITIAL_ROLE);
    expect(grantedCredits).toHaveLength(1);
    expect(grantedCredits.at(0)?.transactionNo).toBe(`welcome-credit:${createdUser.id}`);
  });

  it("does not grant role or credits when both switches are disabled", async () => {
    state.configs = {
      initial_credits_amount: String(INITIAL_CREDITS),
      initial_credits_enabled: "false",
      initial_role_enabled: "false",
      initial_role_name: INITIAL_ROLE,
    };

    await invokeCreateAfterHook();

    if (!state.database) {
      throw new Error("Test database is not initialized");
    }
    expect(await readRole()).toBe("user");
    expect(await state.database.select().from(credit)).toHaveLength(0);
  });
});
