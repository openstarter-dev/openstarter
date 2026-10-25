/**
 * AI model catalog service — CRUD + availability filtering over the `ai_model`
 * table (Task 2 schema).
 *
 * 纯 drizzle + 过滤逻辑：Zod 校验边界归 Task 4 的 router。可用性 = LLM 侧
 * `getAvailableProviders()` ∪ 媒体侧 `getAIManager().getProviderNames()` 的并集，
 * 只有 provider 可用且 `enabled` 的模型才会出现在
 * {@link listAvailableModelsByMediaType} 的结果里。
 *
 * 写入不依赖 MySQL 缺失的 `.returning()`，而是「插入 / 更新后按 id 回读」返回完整记录。
 */

import { db } from "@openstarter/db/server";
import { aiModel, type AiModel, type NewAiModel } from "@openstarter/db/schema";
import { getUuid } from "@openstarter/shared/id";
import { and, asc, eq } from "drizzle-orm";

import { getAIManager } from "../media/manager";
import { getAvailableProviders } from "../llm/provider";

/** AI 生成的媒体类型清单（目录分组键）。 */
export const AI_MEDIA_TYPES = ["text", "image", "video", "music", "speech"] as const;

/** 模型目录的媒体类型。 */
export type AIModelMediaType = (typeof AI_MEDIA_TYPES)[number];

/** 模型重复错误：`(provider, modelId)` 唯一约束冲突时抛出。 */
export class DuplicateModelError extends Error {
  constructor() {
    super("AI model with this provider and modelId already exists");
    this.name = "DuplicateModelError";
  }
}

// ─── 查询（Read） ────────────────────────────────────────────────────────────

/**
 * List catalog models ordered by `sortOrder ASC, createdAt ASC`.
 * `enabledOnly` 为真时只返回启用中的模型。
 */
export async function listModels(args: { enabledOnly?: boolean } = {}): Promise<AiModel[]> {
  const query = db().select().from(aiModel).orderBy(asc(aiModel.sortOrder), asc(aiModel.createdAt));

  if (args.enabledOnly) {
    return query.where(eq(aiModel.enabled, true));
  }
  return query;
}

/**
 * Find one catalog model by its natural key `(provider, modelId)`.
 * Task 5 计费用：按目录价查询扣费额度。
 */
export async function findModelByProviderAndId(
  provider: string,
  modelId: string,
): Promise<AiModel | null> {
  const results = await db()
    .select()
    .from(aiModel)
    .where(and(eq(aiModel.provider, provider), eq(aiModel.modelId, modelId)))
    .limit(1);

  return results[0] ?? null;
}

/**
 * Group enabled models whose provider is currently available by media type.
 *
 * 可用性取双侧并集：LLM 侧（`getAvailableProviders`，经配置键判定）∪ 媒体侧
 * （`getAIManager().getProviderNames()`，装配即可用）。分组用 `for...of`
 * 累积到新对象，不原地修改查询结果。
 */
export async function listAvailableModelsByMediaType(): Promise<
  Record<AIModelMediaType, AiModel[]>
> {
  const [models, llmProviders, mediaManager] = await Promise.all([
    listModels({ enabledOnly: true }),
    getAvailableProviders(),
    getAIManager(),
  ]);
  const availableProviders = new Set([...llmProviders, ...mediaManager.getProviderNames()]);

  const grouped = Object.fromEntries(
    AI_MEDIA_TYPES.map((mediaType) => [mediaType, [] as AiModel[]]),
  ) as Record<AIModelMediaType, AiModel[]>;

  for (const model of models) {
    if (availableProviders.has(model.provider)) {
      grouped[model.mediaType as AIModelMediaType].push(model);
    }
  }

  return grouped;
}

// ─── 创建（Create） ──────────────────────────────────────────────────────────

/**
 * Create a catalog model. `id` 服务端生成；`(provider, modelId)` 冲突抛
 * {@link DuplicateModelError}。插入后按 id 回读返回完整记录。
 */
export async function createModel(args: Omit<NewAiModel, "id">): Promise<AiModel> {
  const id = getUuid();

  try {
    await db()
      .insert(aiModel)
      .values({ ...args, id });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateModelError();
    }
    throw error;
  }

  const created = await findModelById(id);
  if (!created) {
    throw new Error("Failed to load AI model after creation");
  }
  return created;
}

// ─── 更新 / 删除（Update / Delete） ─────────────────────────────────────────

/**
 * Update a catalog model by id. `updatedAt` 总是刷新；未提供任何变更字段时
 * 仅回读原记录。目标不存在返回 `null`。
 */
export async function updateModel(
  args: { id: string } & Partial<Omit<NewAiModel, "id">>,
): Promise<AiModel | null> {
  const existing = await findModelById(args.id);
  if (!existing) {
    return null;
  }

  const { id: _id, ...changes } = args;
  await db()
    .update(aiModel)
    .set({
      ...changes,
      updatedAt: new Date(),
    })
    .where(eq(aiModel.id, args.id));

  const updated = await findModelById(args.id);
  if (!updated) {
    throw new Error("Failed to load AI model after update");
  }
  return updated;
}

/**
 * Delete a catalog model by id. Returns whether a row was removed.
 */
export async function deleteModel(id: string): Promise<boolean> {
  const existing = await findModelById(id);
  if (!existing) {
    return false;
  }

  await db().delete(aiModel).where(eq(aiModel.id, id));
  return true;
}

// ─── 内部工具 ────────────────────────────────────────────────────────────────

/** Load one model by primary key, or `null`. */
function findModelById(id: string): Promise<AiModel | null> {
  return db()
    .select()
    .from(aiModel)
    .where(eq(aiModel.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

/** Detect sqlite/postgres/mysql unique-constraint violations for (provider, model_id). */
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const cause = error.cause instanceof Error ? error.cause : undefined;
  const codes = [error, cause].flatMap((e) => (e ? [(e as { code?: string }).code] : []));
  if (
    codes.some(
      (code) => code === "SQLITE_CONSTRAINT_UNIQUE" || code === "23505" || code === "ER_DUP_ENTRY",
    )
  ) {
    return true;
  }
  return [error.message, cause?.message].some((message) =>
    /UNIQUE constraint failed|duplicate key value|unique constraint/i.test(message ?? ""),
  );
}
