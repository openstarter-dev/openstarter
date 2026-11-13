import { db } from "@openstarter/db/server";
import { aiModel, type AiModel, type NewAiModel } from "@openstarter/db/schema";
import { getUuid } from "@openstarter/shared/id";
import { and, asc, eq } from "drizzle-orm";

import { getAIManager } from "../media/manager";
import { getAvailableProviders } from "../llm/provider";
import { AI_MEDIA_TYPES, type AIModelMediaType } from "../../../schema/ai/catalog";

export class DuplicateModelError extends Error {
  constructor() {
    super("AI model with this provider and modelId already exists");
    this.name = "DuplicateModelError";
  }
}

export async function listModels(args: { enabledOnly?: boolean } = {}): Promise<AiModel[]> {
  const query = db().select().from(aiModel).orderBy(asc(aiModel.sortOrder), asc(aiModel.createdAt));

  if (args.enabledOnly) {
    return query.where(eq(aiModel.enabled, true));
  }
  return query;
}

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

export async function deleteModel(id: string): Promise<boolean> {
  const existing = await findModelById(id);
  if (!existing) {
    return false;
  }

  await db().delete(aiModel).where(eq(aiModel.id, id));
  return true;
}

function findModelById(id: string): Promise<AiModel | null> {
  return db()
    .select()
    .from(aiModel)
    .where(eq(aiModel.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

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
