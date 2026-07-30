import { credit, role, user, userRole } from "@openstarter/db/schema";
import type { Database } from "@openstarter/db/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  closeAuthTestDatabase,
  createAuthTestDatabase,
  resetAuthTestDatabase,
} from "../test/auth-test-database";
import { hooks } from "./index";

const FIXED_NOW = new Date("2026-07-24T00:00:00.000Z");
const INITIAL_CREDITS = 120;

const state = vi.hoisted(() => ({
  configs: {} as Record<string, string>,
  database: undefined as Database | undefined,
  idSequence: 0,
  snowSequence: 0,
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@openstarter/db/server")>();
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

const seedCreatedUserAndRole = async () => {
  if (!state.database) {
    throw new Error("Test database is not initialized");
  }
  await state.database.insert(user).values(createdUser);
  await state.database.insert(role).values({
    createdAt: FIXED_NOW,
    id: "member-role",
    name: "member",
    status: "active",
    title: "Member",
    updatedAt: FIXED_NOW,
  });
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
  await seedCreatedUserAndRole();
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
      initial_role_name: "member",
    };

    await invokeCreateAfterHook();

    if (!state.database) {
      throw new Error("Test database is not initialized");
    }
    const assignedRoles = await state.database.select().from(userRole);
    const grantedCredits = await state.database.select().from(credit);
    expect(assignedRoles).toMatchObject([
      { roleId: "member-role", userId: createdUser.id },
    ]);
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
    expect(grantedCredits.at(0)?.expiresAt).toEqual(
      new Date("2026-08-23T00:00:00.000Z")
    );
  });

  it("keeps role and credit grants idempotent when the hook repeats", async () => {
    state.configs = {
      initial_credits_amount: String(INITIAL_CREDITS),
      initial_credits_enabled: "true",
      initial_credits_valid_days: "0",
      initial_role_enabled: "true",
      initial_role_name: "member",
    };

    await invokeCreateAfterHook();
    await invokeCreateAfterHook();

    if (!state.database) {
      throw new Error("Test database is not initialized");
    }
    expect(await state.database.select().from(userRole)).toHaveLength(1);
    expect(await state.database.select().from(credit)).toHaveLength(1);
  });

  it("grants exactly one role and one welcome credit under concurrent hooks", async () => {
    state.configs = {
      initial_credits_amount: String(INITIAL_CREDITS),
      initial_credits_enabled: "true",
      initial_credits_valid_days: "0",
      initial_role_enabled: "true",
      initial_role_name: "member",
    };

    await Promise.all(Array.from({ length: 8 }, () => invokeCreateAfterHook()));

    if (!state.database) {
      throw new Error("Test database is not initialized");
    }
    const assignedRoles = await state.database.select().from(userRole);
    const grantedCredits = await state.database.select().from(credit);
    expect(assignedRoles).toHaveLength(1);
    expect(grantedCredits).toHaveLength(1);
    expect(grantedCredits.at(0)?.transactionNo).toBe(
      `welcome-credit:${createdUser.id}`
    );
  });

  it("does not grant role or credits when both switches are disabled", async () => {
    state.configs = {
      initial_credits_amount: String(INITIAL_CREDITS),
      initial_credits_enabled: "false",
      initial_role_enabled: "false",
      initial_role_name: "member",
    };

    await invokeCreateAfterHook();

    if (!state.database) {
      throw new Error("Test database is not initialized");
    }
    expect(await state.database.select().from(userRole)).toHaveLength(0);
    expect(await state.database.select().from(credit)).toHaveLength(0);
  });
});
