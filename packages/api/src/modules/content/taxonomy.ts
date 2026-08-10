// packages/api/src/content/taxonomy —— 分类管理服务（Taxonomy_Service，R15）。
//
// 对齐 ShipAny `modules/taxonomy`，落位于 `packages/api/content`。提供分类的创建 / 读取 /
// 更新 / 软删除（R15.1）；`parentId` 构成父子分层（R15.2）；`slug` 统一小写并唯一——冲突以
// 可识别的 {@link SlugConflictError} 抛出（R15.3，供路由层转结构化响应，不裸抛字符串）；
// 以及按 `type`/`status` 组合筛选、按 `sort` 排序的列表查询（R15.4）。
//
// 数据访问统一走 `@openstarter/db`（`db()` 单例 + `@openstarter/db/schema` 表定义），跨方言一致：
// 写入不依赖 MySQL 缺失的 `.returning()`，而是「插入 / 更新后按 id 回读」返回完整记录。
// 软删除置 `deletedAt=now` 且 `status=archived`；所有读取默认排除已软删记录（`deletedAt IS NULL`）。
//
// slug 唯一校验对**全部**记录（含已软删）生效，与 DB 层 `slug` 唯一约束保持一致——避免应用层
// 放行后再撞库约束抛出裸错误。

import { type NewTaxonomy, type Taxonomy, taxonomy } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { and, asc, count, eq, isNull, type SQL } from "drizzle-orm";

import { SlugConflictError } from "./errors";

// 分类状态（`as const`，禁用 enum）：`published` 默认可见，`archived` 兼作软删除标记。
export const TaxonomyStatus = {
  PUBLISHED: "published",
  PENDING: "pending",
  DRAFT: "draft",
  ARCHIVED: "archived",
} as const;

export type TaxonomyStatus = (typeof TaxonomyStatus)[keyof typeof TaxonomyStatus];

// 状态取值元组（非空 tuple），供路由层 `zValidator` 的 `z.enum` 复用。
export const TAXONOMY_STATUS_VALUES = [
  TaxonomyStatus.PUBLISHED,
  TaxonomyStatus.PENDING,
  TaxonomyStatus.DRAFT,
  TaxonomyStatus.ARCHIVED,
] as const;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;

// ─── 类型（Types）─────────────────────────────────────────────────────────────

/** 创建分类入参。`userId` 为创建者；`parentId` 指定父级构成分层（R15.2）。 */
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

/** 更新分类入参（部分字段）。仅传入的字段被更新。 */
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

/** 列表筛选入参（R15.4）。省略的条件不参与筛选。 */
export type ListTaxonomyParams = {
  type?: string;
  status?: string;
  parentId?: string;
  page?: number;
  pageSize?: number;
};

/** 列表返回：命中项与总数（与 `respPage` 结构一致）。 */
export type ListTaxonomyResult = {
  items: Taxonomy[];
  total: number;
};

// ─── slug 唯一校验（R15.3）─────────────────────────────────────────────────────

/**
 * 确认 `slug` 未被占用；冲突抛 {@link SlugConflictError}。
 *
 * 查询覆盖**全部**记录（含已软删），因 DB `slug` 唯一约束对软删记录同样生效；
 * 更新场景经 `excludeId` 排除记录自身。
 */
async function assertSlugAvailable(
  slug: string,
  excludeId?: string
): Promise<void> {
  const [existing] = await db()
    .select({ id: taxonomy.id })
    .from(taxonomy)
    .where(eq(taxonomy.slug, slug))
    .limit(1);
  if (existing && existing.id !== excludeId) {
    throw new SlugConflictError(slug);
  }
}

// ─── 读取（Read，R15.1）─────────────────────────────────────────────────────────

/** 按 id 读取单条分类（排除已软删记录）；不存在返回 `undefined`。 */
export async function getTaxonomyById(
  id: string
): Promise<Taxonomy | undefined> {
  const [result] = await db()
    .select()
    .from(taxonomy)
    .where(and(eq(taxonomy.id, id), isNull(taxonomy.deletedAt)))
    .limit(1);
  return result;
}

// ─── 创建（Create，R15.1 / R15.2 / R15.3）───────────────────────────────────────

/**
 * 创建分类：`slug` 统一小写并做唯一校验（冲突抛 {@link SlugConflictError}）；
 * `status` 缺省为 `published`，`sort` 缺省为 0。插入后按 id 回读返回完整记录（跨方言一致）。
 */
export async function createTaxonomy(
  input: CreateTaxonomyInput
): Promise<Taxonomy> {
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

// ─── 更新（Update，R15.1 / R15.3）───────────────────────────────────────────────

/**
 * 更新分类（部分字段）：传入 `slug` 时统一小写并做唯一校验（排除自身，冲突抛
 * {@link SlugConflictError}）。更新后按 id 回读返回完整记录；记录不存在（或已软删）返回 `undefined`。
 */
export async function updateTaxonomy(
  id: string,
  input: UpdateTaxonomyInput
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

// ─── 软删除（Soft delete，R15.1）───────────────────────────────────────────────

/** 软删除分类：置 `deletedAt=now` 且 `status=archived`（不物理删除）。 */
export async function deleteTaxonomy(id: string): Promise<void> {
  await db()
    .update(taxonomy)
    .set({ status: TaxonomyStatus.ARCHIVED, deletedAt: new Date() })
    .where(and(eq(taxonomy.id, id), isNull(taxonomy.deletedAt)));
}

// ─── 列表：筛选与排序（List，R15.4）─────────────────────────────────────────────

/**
 * 按 `type`/`status` 组合筛选，并按 `sort` 升序返回（`createdAt` 升序为稳定次序）。
 * 默认排除已软删记录；可选按 `parentId` 取某父级下的子分类（支撑 R15.2 分层的可查询性）。
 */
export async function listTaxonomy(
  params: ListTaxonomyParams
): Promise<ListTaxonomyResult> {
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

  const [totalRow] = await db()
    .select({ value: count() })
    .from(taxonomy)
    .where(where);

  const items = await db()
    .select()
    .from(taxonomy)
    .where(where)
    .orderBy(asc(taxonomy.sort), asc(taxonomy.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total: totalRow?.value ?? 0 };
}
