import { type NewTaxonomy, type Taxonomy, taxonomy } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { and, asc, count, eq, isNull, type SQL } from "drizzle-orm";

import { SlugConflictError } from "./errors";
import { TaxonomyStatus } from "../../schema/content/taxonomy";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;

export type CreateTaxonomyInput = {
  userId: string;
  slug: string;
  type: string;
  title: string;
  description?: string | null;
  parentId?: string | null;
  sort?: number;
  status?: TaxonomyStatus;
  image?: string | null;
  icon?: string | null;
};

export type UpdateTaxonomyInput = {
  slug?: string;
  type?: string;
  title?: string;
  description?: string | null;
  parentId?: string | null;
  sort?: number;
  status?: TaxonomyStatus;
  image?: string | null;
  icon?: string | null;
};

export type ListTaxonomyParams = {
  type?: string;
  status?: string;
  parentId?: string;
  page?: number;
  pageSize?: number;
};

export type ListTaxonomyResult = {
  items: Taxonomy[];
  total: number;
};

async function assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
  const [existing] = await db()
    .select({ id: taxonomy.id })
    .from(taxonomy)
    .where(eq(taxonomy.slug, slug))
    .limit(1);
  if (existing && existing.id !== excludeId) {
    throw new SlugConflictError(slug);
  }
}

export async function getTaxonomyById(id: string): Promise<Taxonomy | undefined> {
  const [result] = await db()
    .select()
    .from(taxonomy)
    .where(and(eq(taxonomy.id, id), isNull(taxonomy.deletedAt)))
    .limit(1);
  return result;
}

export async function createTaxonomy(input: CreateTaxonomyInput): Promise<Taxonomy> {
  const slug = input.slug.toLowerCase();
  await assertSlugAvailable(slug);

  const id = getUuid();
  const record: NewTaxonomy = {
    id,
    userId: input.userId,
    parentId: input.parentId ?? null,
    slug,
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    image: input.image ?? null,
    icon: input.icon ?? null,
    status: input.status ?? TaxonomyStatus.PUBLISHED,
    sort: input.sort ?? 0,
  };

  await db().insert(taxonomy).values(record);

  const created = await getTaxonomyById(id);
  if (!created) {
    throw new Error("Failed to load taxonomy after creation");
  }
  return created;
}

export async function updateTaxonomy(
  id: string,
  input: UpdateTaxonomyInput,
): Promise<Taxonomy | undefined> {
  const patch: Partial<NewTaxonomy> = {};

  if (input.slug !== undefined) {
    const slug = input.slug.toLowerCase();
    await assertSlugAvailable(slug, id);
    patch.slug = slug;
  }
  if (input.type !== undefined) {
    patch.type = input.type;
  }
  if (input.title !== undefined) {
    patch.title = input.title;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.parentId !== undefined) {
    patch.parentId = input.parentId;
  }
  if (input.sort !== undefined) {
    patch.sort = input.sort;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }
  if (input.image !== undefined) {
    patch.image = input.image;
  }
  if (input.icon !== undefined) {
    patch.icon = input.icon;
  }

  if (Object.keys(patch).length > 0) {
    await db()
      .update(taxonomy)
      .set(patch)
      .where(and(eq(taxonomy.id, id), isNull(taxonomy.deletedAt)));
  }

  return getTaxonomyById(id);
}

export async function deleteTaxonomy(id: string): Promise<void> {
  await db()
    .update(taxonomy)
    .set({ status: TaxonomyStatus.ARCHIVED, deletedAt: new Date() })
    .where(and(eq(taxonomy.id, id), isNull(taxonomy.deletedAt)));
}

export async function listTaxonomy(params: ListTaxonomyParams): Promise<ListTaxonomyResult> {
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = [isNull(taxonomy.deletedAt)];
  if (params.type !== undefined) {
    conditions.push(eq(taxonomy.type, params.type));
  }
  if (params.status !== undefined) {
    conditions.push(eq(taxonomy.status, params.status));
  }
  if (params.parentId !== undefined) {
    conditions.push(eq(taxonomy.parentId, params.parentId));
  }
  const where = and(...conditions);

  const [totalRow] = await db().select({ value: count() }).from(taxonomy).where(where);

  const items = await db()
    .select()
    .from(taxonomy)
    .where(where)
    .orderBy(asc(taxonomy.sort), asc(taxonomy.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total: totalRow?.value ?? 0 };
}
