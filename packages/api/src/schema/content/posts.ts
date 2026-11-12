// packages/api/src/schema/content/posts —— posts 域类型与入参校验
// （modules/content/posts 路由与服务复用）。
import { z } from "zod";

import { createPaginationSchema } from "../shared";

// ─── 域词汇表（as const，禁用 enum；service 与路由共享的单一事实源） ──────────

// 文章类型（`as const`，禁用 enum）：`article` 为博客文章（默认），`page`/`log` 为其它内容类型。
export const PostType = {
  ARTICLE: "article",
  PAGE: "page",
  LOG: "log",
} as const;

export type PostType = (typeof PostType)[keyof typeof PostType];

// 文章状态（`as const`）：`published` 公开可见，`archived` 兼作软删除标记。
export const PostStatus = {
  PUBLISHED: "published",
  PENDING: "pending",
  DRAFT: "draft",
  ARCHIVED: "archived",
} as const;

export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

// 取值元组（非空 tuple），供路由层 `zValidator` 的 `z.enum` 复用。
export const POST_TYPE_VALUES = [PostType.ARTICLE, PostType.PAGE, PostType.LOG] as const;

export const POST_STATUS_VALUES = [
  PostStatus.PUBLISHED,
  PostStatus.PENDING,
  PostStatus.DRAFT,
  PostStatus.ARCHIVED,
] as const;

// ─── 入参校验（zValidator） ────────────────────────────────────────────────────

export const listQuery = createPaginationSchema(100, 10).extend({
  type: z.enum(POST_TYPE_VALUES).optional(),
  status: z.enum(POST_STATUS_VALUES).optional(),
  search: z.string().min(1).optional(),
});

export const createBody = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(POST_TYPE_VALUES).optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  image: z.string().optional(),
  categories: z.string().optional(),
  tags: z.string().optional(),
  authorName: z.string().optional(),
  authorImage: z.string().optional(),
  parentId: z.string().min(1).optional(),
  status: z.enum(POST_STATUS_VALUES).optional(),
  sort: z.number().int().optional(),
});

export const updateBody = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  type: z.enum(POST_TYPE_VALUES).optional(),
  description: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  categories: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
  authorName: z.string().nullable().optional(),
  authorImage: z.string().nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  status: z.enum(POST_STATUS_VALUES).optional(),
  sort: z.number().int().optional(),
});
