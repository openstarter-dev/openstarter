// Property tests for the AI tasks service (Task 27).
//
// Reuses the in-memory SQLite harness in `src/test/api-test-database.ts`. The
// committed harness DDL for `ai_task` predates the active schema (it declares
// legacy `task_no` / `user_email` / `result_url` / `error` columns the service no
// longer writes and omits `scene` / `task_id` / `task_info` / `task_result` the
// service now writes), so we drop & recreate the `ai_task` table in-shape
// (matching `packages/db/src/schema/schema.sqlite.ts`) right after the harness
// is created. No other source file is touched.

import { grant } from "@openstarter/billing-web";
import { aiTask, credit } from "@openstarter/db/schema";
import { type Database, db } from "@openstarter/db/server";
import { sql } from "drizzle-orm";
import fc from "fast-check";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AITaskStatus } from "../ai";
import {
  closeApiTestDatabase,
  createApiTestDatabase,
  insertUser,
  resetApiTestDatabase,
} from "../../test/api-test-database";
import {
  createTask,
  getTasks,
  InsufficientCreditsError,
  updateTask,
} from "./service";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("ai-tasks test database not initialized");
      }
      return state.database;
    },
  };
});

const NOW_EXPR = "(cast((julianday('now') - 2440587.5)*86400000 as integer))";

// Reshape `ai_task` to match the drizzle sqlite schema (see header comment).
const RESHAPE_AI_TASK: readonly string[] = [
  "DROP TABLE IF EXISTS ai_task",
  `CREATE TABLE ai_task (
    id TEXT PRIMARY KEY,
    cost_credits INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    credit_id TEXT,
    deleted_at INTEGER,
    media_type TEXT NOT NULL,
    model TEXT NOT NULL,
    options TEXT,
    prompt TEXT NOT NULL,
    provider TEXT NOT NULL,
    scene TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    task_id TEXT,
    task_info TEXT,
    task_result TEXT,
    updated_at INTEGER NOT NULL DEFAULT ${NOW_EXPR},
    user_id TEXT NOT NULL
  )`,
];

const sumRemainingCredits = async (userId: string): Promise<number> => {
  const rows = await db()
    .select({ value: sql<number>`coalesce(sum(remaining_credits), 0)` })
    .from(credit)
    .where(
      sql`user_id = ${userId} and transaction_type = 'grant' and status = 'active' and remaining_credits > 0`
    );
  const value = rows[0]?.value;
  return typeof value === "number"
    ? value
    : Number.parseInt(String(value ?? "0"), 10);
};

const PROVIDERS = ["replicate", "fal", "openai"] as const;
const MEDIA_TYPES = ["image", "video", "text", "speech"] as const;
const TASK_STATUSES = [
  AITaskStatus.PENDING,
  AITaskStatus.PROCESSING,
  AITaskStatus.SUCCESS,
  AITaskStatus.FAILED,
  AITaskStatus.CANCELED,
] as const;

describe("ai tasks (P39, P40, P41, P42, P43)", () => {
  beforeAll(async () => {
    state.database = await createApiTestDatabase("ai-tasks-property");
    await RESHAPE_AI_TASK.reduce(async (previous, statement) => {
      await previous;
      const database = state.database as Database;
      await database.run(sql.raw(statement));
    }, Promise.resolve());
  });
  afterAll(() => {
    if (state.database) {
      closeApiTestDatabase(state.database);
    }
  });
  beforeEach(async () => {
    if (state.database) {
      await resetApiTestDatabase(state.database);
    }
  });

  /** Property 39: AI task creation atomically consumes credits */
  it("P39 for balance >= cost > 0, createTask persists a pending task, stores the consume record id in creditId, and drops the balance by exactly cost", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ max: 10_000, min: 1 }),
        fc.integer({ max: 10_000, min: 1 }),
        fc.constantFrom(...PROVIDERS),
        fc.constantFrom(...MEDIA_TYPES),
        fc.integer({ max: 100, min: 1 }),
        async (costCredits, extraBalance, provider, mediaType, runNonce) => {
          const userId = `p39-user-${runNonce}`;
          await insertUser(db(), {
            email: `${userId}@example.com`,
            id: userId,
          });
          await grant({
            credits: costCredits + extraBalance,
            description: "seed",
            userId,
          });

          const balanceBefore = await sumRemainingCredits(userId);
          const created = await createTask({
            costCredits,
            mediaType,
            model: "test-model",
            prompt: "test-prompt",
            provider,
            userId,
          });
          const balanceAfter = await sumRemainingCredits(userId);

          expect(created.status).toBe(AITaskStatus.PENDING);
          expect(created.costCredits).toBe(costCredits);
          expect(created.userId).toBe(userId);
          expect(created.mediaType).toBe(mediaType);
          expect(created.provider).toBe(provider);
          expect(created.creditId).not.toBeNull();
          expect(typeof created.creditId).toBe("string");
          expect(created.creditId?.length).toBeGreaterThan(0);

          const consumeRow = await db()
            .select()
            .from(credit)
            .where(sql`id = ${created.creditId}`);
          expect(consumeRow).toHaveLength(1);
          expect(consumeRow[0]?.transactionType).toBe("consume");
          expect(consumeRow[0]?.credits).toBe(-costCredits);

          const taskRows = await db().select().from(aiTask);
          expect(taskRows).toHaveLength(1);
          expect(taskRows[0]?.id).toBe(created.id);
          expect(taskRows[0]?.status).toBe(AITaskStatus.PENDING);
          expect(taskRows[0]?.costCredits).toBe(costCredits);
          expect(taskRows[0]?.creditId).toBe(created.creditId);

          expect(balanceAfter).toBe(balanceBefore - costCredits);

          await resetApiTestDatabase(db());
        }
      ),
      { numRuns: 20 }
    );
  });

  /** Property 40: Insufficient credits rolls back task creation entirely */
  it("P40 for cost > balance >= 0, createTask rejects with InsufficientCreditsError and leaves no ai_task row and balance unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ max: 10_000, min: 1 }),
        fc.integer({ max: 10_000, min: 0 }),
        fc.constantFrom(...PROVIDERS),
        fc.constantFrom(...MEDIA_TYPES),
        fc.integer({ max: 100, min: 1 }),
        async (costCredits, grantedBalance, provider, mediaType, runNonce) => {
          const userId = `p40-user-${runNonce}`;
          await insertUser(db(), {
            email: `${userId}@example.com`,
            id: userId,
          });
          if (grantedBalance > 0) {
            await grant({
              credits: grantedBalance,
              description: "seed",
              userId,
            });
          }
          // Guarantee the cost strictly exceeds the available balance.
          const effectiveCost = costCredits + grantedBalance + 1;

          const balanceBefore = await sumRemainingCredits(userId);

          await expect(
            createTask({
              costCredits: effectiveCost,
              mediaType,
              model: "test-model",
              prompt: "test-prompt",
              provider,
              userId,
            })
          ).rejects.toBeInstanceOf(InsufficientCreditsError);

          const taskRows = await db().select().from(aiTask);
          expect(taskRows).toHaveLength(0);

          const balanceAfter = await sumRemainingCredits(userId);
          expect(balanceAfter).toBe(balanceBefore);

          await resetApiTestDatabase(db());
        }
      ),
      { numRuns: 20 }
    );
  });

  /** Property 41: Task failure revokes already-consumed credits */
  it("P41 for a pending task with cost > 0, updateTask to failed revokes the prior consume and restores the balance to the pre-task level", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ max: 5000, min: 1 }),
        fc.integer({ max: 5000, min: 0 }),
        fc.constantFrom(...PROVIDERS),
        fc.constantFrom(...MEDIA_TYPES),
        fc.integer({ max: 100, min: 1 }),
        async (costCredits, extraBalance, provider, mediaType, runNonce) => {
          const userId = `p41-user-${runNonce}`;
          await insertUser(db(), {
            email: `${userId}@example.com`,
            id: userId,
          });
          await grant({
            credits: costCredits + extraBalance,
            description: "seed",
            userId,
          });

          const balanceBeforeTask = await sumRemainingCredits(userId);
          const created = await createTask({
            costCredits,
            mediaType,
            model: "test-model",
            prompt: "test-prompt",
            provider,
            userId,
          });
          const balanceAfterCreate = await sumRemainingCredits(userId);
          expect(balanceAfterCreate).toBe(balanceBeforeTask - costCredits);
          expect(created.creditId).not.toBeNull();
          const consumedCreditId = created.creditId as string;

          await updateTask({ id: created.id, status: AITaskStatus.FAILED });

          const balanceAfterFail = await sumRemainingCredits(userId);
          const consumeRow = await db()
            .select()
            .from(credit)
            .where(sql`id = ${consumedCreditId}`);
          const taskRows = await db().select().from(aiTask);

          expect(balanceAfterFail).toBe(balanceBeforeTask);
          expect(consumeRow).toHaveLength(1);
          expect(consumeRow[0]?.status).toBe("deleted");
          expect(taskRows).toHaveLength(1);
          expect(taskRows[0]?.status).toBe(AITaskStatus.FAILED);
          expect(taskRows[0]?.creditId).toBe(consumedCreditId);

          await resetApiTestDatabase(db());
        }
      ),
      { numRuns: 20 }
    );
  });

  /** Property 42: Task success retains the credit deduction */
  it("P42 for a pending task with cost > 0, updateTask to success leaves the consume record active and the balance at the post-deduction level", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ max: 5000, min: 1 }),
        fc.integer({ max: 5000, min: 0 }),
        fc.constantFrom(...PROVIDERS),
        fc.constantFrom(...MEDIA_TYPES),
        fc.integer({ max: 100, min: 1 }),
        async (costCredits, extraBalance, provider, mediaType, runNonce) => {
          const userId = `p42-user-${runNonce}`;
          await insertUser(db(), {
            email: `${userId}@example.com`,
            id: userId,
          });
          await grant({
            credits: costCredits + extraBalance,
            description: "seed",
            userId,
          });

          const balanceBeforeTask = await sumRemainingCredits(userId);
          const created = await createTask({
            costCredits,
            mediaType,
            model: "test-model",
            prompt: "test-prompt",
            provider,
            userId,
          });
          const balanceAfterCreate = await sumRemainingCredits(userId);
          expect(balanceAfterCreate).toBe(balanceBeforeTask - costCredits);
          expect(created.creditId).not.toBeNull();
          const consumedCreditId = created.creditId as string;

          await updateTask({
            id: created.id,
            providerTaskId: "provider-task-abc",
            status: AITaskStatus.SUCCESS,
            taskResult: { url: "https://example.com/output.bin" },
          });

          const balanceAfterSuccess = await sumRemainingCredits(userId);
          const consumeRow = await db()
            .select()
            .from(credit)
            .where(sql`id = ${consumedCreditId}`);
          const taskRows = await db().select().from(aiTask);

          expect(balanceAfterSuccess).toBe(balanceAfterCreate);
          expect(consumeRow).toHaveLength(1);
          expect(consumeRow[0]?.status).toBe("active");
          expect(consumeRow[0]?.transactionType).toBe("consume");
          expect(consumeRow[0]?.credits).toBe(-costCredits);
          expect(taskRows).toHaveLength(1);
          expect(taskRows[0]?.status).toBe(AITaskStatus.SUCCESS);
          expect(taskRows[0]?.creditId).toBe(consumedCreditId);

          await resetApiTestDatabase(db());
        }
      ),
      { numRuns: 20 }
    );
  });

  /** Property 43: AI task pagination/filter consistency */
  it("P43 varied userId/mediaType/status seeding yields consistent getTasks filters by userId, mediaType, and status", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ max: 4, min: 1 }),
        fc.integer({ max: 12, min: 0 }),
        async (userCount, tasksPerUser) => {
          const userIds = Array.from(
            { length: userCount },
            (_, index) => `owner-${index}`
          );
          await userIds.reduce(async (previous, userId) => {
            await previous;
            await insertUser(db(), {
              email: `${userId}@example.com`,
              id: userId,
            });
          }, Promise.resolve());

          const emptyMedia: Record<string, number> = {
            image: 0,
            speech: 0,
            text: 0,
            video: 0,
          };
          const emptyStatus: Record<string, number> = {
            canceled: 0,
            failed: 0,
            pending: 0,
            processing: 0,
            success: 0,
          };
          const expected = new Map<
            string,
            {
              perCombo: Record<string, number>;
              perMedia: Record<string, number>;
              perStatus: Record<string, number>;
              total: number;
            }
          >();
          for (const userId of userIds) {
            const perCombo: Record<string, number> = {};
            for (const media of MEDIA_TYPES) {
              for (const status of TASK_STATUSES) {
                perCombo[`${media}|${status}`] = 0;
              }
            }
            expected.set(userId, {
              perCombo,
              perMedia: { ...emptyMedia },
              perStatus: { ...emptyStatus },
              total: 0,
            });
          }

          const taskJobs = Array.from(
            { length: userCount * tasksPerUser },
            (_, index) => ({
              taskIndex: index % tasksPerUser,
              userIndex: Math.floor(index / tasksPerUser),
            })
          );
          await taskJobs.reduce(async (previous, { taskIndex, userIndex }) => {
            await previous;
            const userId = userIds[userIndex] as string;
            const chosenMedia = MEDIA_TYPES[
              (userIndex + taskIndex) % MEDIA_TYPES.length
            ] as (typeof PROVIDERS)[number];
            const targetStatus = TASK_STATUSES[
              taskIndex % TASK_STATUSES.length
            ] as (typeof TASK_STATUSES)[number];
            const created = await createTask({
              costCredits: 0,
              mediaType: chosenMedia,
              model: "test-model",
              prompt: `t-${taskIndex}`,
              provider: PROVIDERS[
                taskIndex % PROVIDERS.length
              ] as (typeof PROVIDERS)[number],
              userId,
            });
            if (targetStatus !== AITaskStatus.PENDING) {
              await updateTask({ id: created.id, status: targetStatus });
            }

            const profile = expected.get(userId) as {
              perCombo: Record<string, number>;
              perMedia: Record<string, number>;
              perStatus: Record<string, number>;
              total: number;
            };
            profile.total += 1;
            profile.perMedia[chosenMedia] =
              (profile.perMedia[chosenMedia] ?? 0) + 1;
            profile.perStatus[targetStatus] =
              (profile.perStatus[targetStatus] ?? 0) + 1;
            profile.perCombo[`${chosenMedia}|${targetStatus}`] =
              (profile.perCombo[`${chosenMedia}|${targetStatus}`] ?? 0) + 1;
          }, Promise.resolve());

          await userIds.reduce(async (previous, userId) => {
            await previous;
            const profile = expected.get(userId) as {
              perCombo: Record<string, number>;
              perMedia: Record<string, number>;
              perStatus: Record<string, number>;
              total: number;
            };

            const listAll = await getTasks({ userId });
            expect(listAll.total).toBe(profile.total);
            expect(listAll.items).toHaveLength(profile.total);
            expect(
              listAll.items
                .map((item) => item.userId)
                .every((id) => id === userId)
            ).toBe(true);

            await MEDIA_TYPES.reduce(async (prevMedia, media) => {
              await prevMedia;
              const list = await getTasks({ mediaType: media, userId });
              expect(list.total).toBe(profile.perMedia[media]);
              expect(list.items).toHaveLength(profile.perMedia[media] ?? 0);
              expect(
                list.items
                  .map((item) => item.mediaType)
                  .every((m) => m === media)
              ).toBe(true);
            }, Promise.resolve());

            await TASK_STATUSES.reduce(async (prevStatus, status) => {
              await prevStatus;
              const list = await getTasks({ status, userId });
              expect(list.total).toBe(profile.perStatus[status]);
              expect(list.items).toHaveLength(profile.perStatus[status] ?? 0);
              expect(
                list.items.map((item) => item.status).every((s) => s === status)
              ).toBe(true);
            }, Promise.resolve());

            await MEDIA_TYPES.reduce(async (prevMedia, media) => {
              await prevMedia;
              await TASK_STATUSES.reduce(async (prevStatus, status) => {
                await prevStatus;
                const list = await getTasks({
                  mediaType: media,
                  status,
                  userId,
                });
                const expectedCount =
                  profile.perCombo[`${media}|${status}`] ?? 0;
                expect(list.total).toBe(expectedCount);
                expect(list.items).toHaveLength(expectedCount);
                expect(
                  list.items
                    .map(
                      (item) =>
                        item.mediaType === media && item.status === status
                    )
                    .every(Boolean)
                ).toBe(true);
              }, Promise.resolve());
            }, Promise.resolve());
          }, Promise.resolve());

          await resetApiTestDatabase(db());
        }
      ),
      { numRuns: 20 }
    );
  }, 30_000);
});
