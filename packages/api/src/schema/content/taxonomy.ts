// packages/api/src/schema/content/taxonomy —— taxonomy 域类型与入参校验
// （modules/content/taxonomy 路由与服务复用）。
import { z } from "zod";

import { createPaginationSchema } from "../shared";

// ─── 域词汇表（as const，禁用 enum；service 与路由共享的单一事实源） ──────────

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

// ─── 入参校验（zValidator） ────────────────────────────────────────────────────

export const listQuery = createPaginationSchema(100, 50).extend({
  type: z.string().min(1).optional(),
  status: z.enum(TAXONOMY_STATUS_VALUES).optional(),
  parentId: z.string().min(1).optional(),
});

export const createBody = z.object({
  slug: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().min(1).optional(),
  sort: z.number().int().optional(),
  status: z.enum(TAXONOMY_STATUS_VALUES).optional(),
});

export const updateBody = z.object({
  slug: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  sort: z.number().int().optional(),
  status: z.enum(TAXONOMY_STATUS_VALUES).optional(),
});
