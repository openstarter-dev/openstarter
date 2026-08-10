// packages/api/src/content/posts —— CMS 文章管理服务（CMS_Service，R14）。
//
// 对齐 ShipAny `modules/posts`，落位于 `packages/api/content`（与 Taxonomy_Service 同域同风格）。
// 提供文章（post）的创建 / 读取 / 更新 / 软删除（R14.1），字段覆盖标题 / `slug` / 正文 /
// 封面图 / 分类（关联 taxonomy）/ 标签 / 作者 / 状态；`slug` 统一小写并唯一——冲突以可识别的
// {@link SlugConflictError} 抛出（R14.4，供路由层转结构化 409 响应，不裸抛字符串）。
//
// 发布可见性与筛选：
//   - {@link findPublishedBySlug} 仅返回已发布且未软删的文章（草稿 / 下线 / 软删不可见，R14.2/R14.3）；
//   - {@link listPublishedArticles} 列出已发布文章（type=article、status=published、未软删），
//     设计为可分页、可按分类筛选的**通用**查询，供博客（任务 23）与 sitemap（任务 31）复用；
//   - {@link listPosts} 支持按 `type`/`status` 组合筛选的管理列表（R14.5）。
//
// 数据访问统一走 `@openstarter/db`（`db()` 单例 + `@openstarter/db/schema` 表定义），跨方言一致：
// 写入不依赖 MySQL 缺失的 `.returning()`，而是「插入 / 更新后按 id 回读」返回完整记录。
// 软删除置 `deletedAt=now` 且 `status=archived`；所有读取默认排除已软删记录（`deletedAt IS NULL`）。
//
// slug 唯一校验对**全部**记录（含已软删）生效，与 DB 层 `slug` 唯一约束保持一致——避免应用层
// 放行后再撞库约束抛出裸错误。

import { type NewPost, type Post, post } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { and, count, desc, eq, isNull, like, or, type SQL } from "drizzle-orm";

import { SlugConflictError } from "./errors";

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
export const POST_TYPE_VALUES = [
  PostType.ARTICLE,
  PostType.PAGE,
  PostType.LOG,
] as const;

export const POST_STATUS_VALUES = [
  PostStatus.PUBLISHED,
  PostStatus.PENDING,
  PostStatus.DRAFT,
  PostStatus.ARCHIVED,
] as const;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
// 已发布文章列表默认页大小（博客 / sitemap 复用；较管理列表更大以减少翻页）。
const DEFAULT_PUBLISHED_PAGE_SIZE = 100;

// ─── 类型（Types）─────────────────────────────────────────────────────────────

/** 创建文章入参。`userId` 为作者；`type` 缺省为 `article`；`status` 缺省为 `draft`。 */
export type CreatePostInput = {
  userId: string;
  slug: string;
  title: string;
  type?: PostType;
  description?: string | null;
  content?: string | null;
  image?: string | null;
  categories?: string | null;
  tags?: string | null;
  authorName?: string | null;
  authorImage?: string | null;
  parentId?: string | null;
  status?: PostStatus;
  sort?: number;
};

/** 更新文章入参（部分字段）。仅传入的字段被更新。 */
export type UpdatePostInput = {
  slug?: string;
  title?: string;
  type?: PostType;
  description?: string | null;
  content?: string | null;
  image?: string | null;
  categories?: string | null;
  tags?: string | null;
  authorName?: string | null;
  authorImage?: string | null;
  parentId?: string | null;
  status?: PostStatus;
  sort?: number;
};

/** 管理列表筛选入参（R14.5）。省略的条件不参与筛选。 */
export type ListPostsParams = {
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

/** 管理列表返回：完整记录与总数（与 `respPage` 结构一致）。 */
export type ListPostsResult = {
  items: Post[];
  total: number;
};

/**
 * 已发布文章列表项：面向公开展示的字段投影（不含正文 `content`），
 * 覆盖博客卡片（标题 / 摘要 / 封面 / 作者 / 时间）与 sitemap（`slug` / `updatedAt`）所需。
 */
export type PublishedArticleItem = Pick<
  Post,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "image"
  | "authorName"
  | "authorImage"
  | "categories"
  | "createdAt"
  | "updatedAt"
>;

/** 已发布文章列表筛选入参。`category` 为可选分类筛选（对 `categories` 文本字段做包含匹配）。 */
export type ListPublishedArticlesParams = {
  category?: string;
  page?: number;
  pageSize?: number;
};

/** 已发布文章列表返回：投影项与总数。 */
export type ListPublishedArticlesResult = {
  items: PublishedArticleItem[];
  total: number;
};

/**
 * 已发布文章列表项（含正文 `content`）：在 {@link PublishedArticleItem} 基础上附带正文，
 * 供 SEO 端点 llms-full（任务 31）一次性取全文，避免逐篇回读。
 */
export type PublishedArticleWithContent = PublishedArticleItem & {
  content: string | null;
};

/** 分页入参（`page`/`pageSize` 从 1 起），供已发布文章列表复用。 */
export type PagedParams = {
  page?: number;
  pageSize?: number;
};

// ─── slug 唯一校验（R14.4）─────────────────────────────────────────────────────

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
    .select({ id: post.id })
    .from(post)
    .where(eq(post.slug, slug))
    .limit(1);
  if (existing && existing.id !== excludeId) {
    throw new SlugConflictError(slug);
  }
}

// ─── 读取（Read，R14.1）─────────────────────────────────────────────────────────

/** 按 id 读取单条文章（排除已软删记录）；不存在返回 `undefined`。 */
export async function getPostById(id: string): Promise<Post | undefined> {
  const [result] = await db()
    .select()
    .from(post)
    .where(and(eq(post.id, id), isNull(post.deletedAt)))
    .limit(1);
  return result;
}

// ─── 创建（Create，R14.1 / R14.4）───────────────────────────────────────────────

/**
 * 创建文章：`slug` 统一小写并做唯一校验（冲突抛 {@link SlugConflictError}）；`type` 缺省
 * `article`、`status` 缺省 `draft`、`sort` 缺省 0。插入后按 id 回读返回完整记录（跨方言一致）。
 */
export async function createPost(input: CreatePostInput): Promise<Post> {
  const slug = input.slug.toLowerCase();
  await assertSlugAvailable(slug);

  const id = getUuid();
  const record: NewPost = {
    id,
    userId: input.userId,
    parentId: input.parentId ?? null,
    slug,
    type: input.type ?? PostType.ARTICLE,
    title: input.title,
    description: input.description ?? null,
    image: input.image ?? null,
    content: input.content ?? null,
    categories: input.categories ?? null,
    tags: input.tags ?? null,
    authorName: input.authorName ?? null,
    authorImage: input.authorImage ?? null,
    status: input.status ?? PostStatus.DRAFT,
    sort: input.sort ?? 0,
  };

  await db().insert(post).values(record);

  const created = await getPostById(id);
  if (!created) {
    throw new Error("Failed to load post after creation");
  }
  return created;
}

// ─── 更新（Update，R14.1 / R14.4）───────────────────────────────────────────────

/**
 * 更新文章（部分字段）：传入 `slug` 时统一小写并做唯一校验（排除自身，冲突抛
 * {@link SlugConflictError}）。更新后按 id 回读返回完整记录；记录不存在（或已软删）返回 `undefined`。
 */
export async function updatePost(
  id: string,
  input: UpdatePostInput
): Promise<Post | undefined> {
  const patch: Partial<NewPost> = {};

  if (input.slug !== undefined) {
    const slug = input.slug.toLowerCase();
    await assertSlugAvailable(slug, id);
    patch.slug = slug;
  }
  if (input.title !== undefined) {
    patch.title = input.title;
  }
  if (input.type !== undefined) {
    patch.type = input.type;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.content !== undefined) {
    patch.content = input.content;
  }
  if (input.image !== undefined) {
    patch.image = input.image;
  }
  if (input.categories !== undefined) {
    patch.categories = input.categories;
  }
  if (input.tags !== undefined) {
    patch.tags = input.tags;
  }
  if (input.authorName !== undefined) {
    patch.authorName = input.authorName;
  }
  if (input.authorImage !== undefined) {
    patch.authorImage = input.authorImage;
  }
  if (input.parentId !== undefined) {
    patch.parentId = input.parentId;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }
  if (input.sort !== undefined) {
    patch.sort = input.sort;
  }

  if (Object.keys(patch).length > 0) {
    await db()
      .update(post)
      .set(patch)
      .where(and(eq(post.id, id), isNull(post.deletedAt)));
  }

  return getPostById(id);
}

// ─── 软删除（Soft delete，R14.1）───────────────────────────────────────────────

/** 软删除文章：置 `deletedAt=now` 且 `status=archived`（不物理删除）。 */
export async function deletePost(id: string): Promise<void> {
  await db()
    .update(post)
    .set({ status: PostStatus.ARCHIVED, deletedAt: new Date() })
    .where(and(eq(post.id, id), isNull(post.deletedAt)));
}

// ─── 管理列表：按 type/status 组合筛选（List，R14.5）─────────────────────────────

/**
 * 管理列表：按 `type`/`status` 组合筛选（R14.5），可选按标题 / `slug` 模糊搜索，
 * 按 `updatedAt`/`createdAt` 倒序返回。默认排除已软删记录。
 */
export async function listPosts(
  params: ListPostsParams
): Promise<ListPostsResult> {
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = [isNull(post.deletedAt)];
  if (params.type !== undefined) {
    conditions.push(eq(post.type, params.type));
  }
  if (params.status !== undefined) {
    conditions.push(eq(post.status, params.status));
  }
  if (params.search !== undefined && params.search !== "") {
    const term = `%${params.search}%`;
    const searchCondition = or(like(post.title, term), like(post.slug, term));
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }
  const where = and(...conditions);

  const [totalRow] = await db()
    .select({ value: count() })
    .from(post)
    .where(where);

  const items = await db()
    .select()
    .from(post)
    .where(where)
    .orderBy(desc(post.updatedAt), desc(post.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total: totalRow?.value ?? 0 };
}

// ─── 发布可见性（Published visibility，R14.2 / R14.3）────────────────────────────

/**
 * 按 `slug` 读取**已发布**文章：仅当 `status=published` 且未软删时可见；
 * 草稿 / 下线 / 软删记录返回 `undefined`（R14.2/R14.3）。`slug` 统一小写匹配。
 * 供博客详情（任务 23）经只读 RPC 复用。
 */
export async function findPublishedBySlug(
  slug: string
): Promise<Post | undefined> {
  const [result] = await db()
    .select()
    .from(post)
    .where(
      and(
        eq(post.slug, slug.toLowerCase()),
        eq(post.status, PostStatus.PUBLISHED),
        isNull(post.deletedAt)
      )
    )
    .limit(1);
  return result;
}

/**
 * 列出**已发布文章**（`type=article` 且 `status=published` 且未软删），按 `createdAt` 倒序。
 *
 * 设计为通用的可分页（`page`/`pageSize`）、可按分类（`category`）筛选查询，供博客列表（任务 23）
 * 与 sitemap（任务 31）复用；返回不含正文的字段投影 {@link PublishedArticleItem}。
 *
 * 分类筛选对 `categories` 文本字段做包含匹配（该字段以文本承载分类关联）；精确的归属语义由
 * 消费方（博客按分类筛选，任务 23）按需细化。
 */
/**
 * 「已发布文章」的发布可见性谓词（`type=article` 且 `status=published` 且未软删）。
 *
 * 作为 {@link listPublishedArticles} 与 {@link listPublishedArticlesWithContent} 的**唯一**
 * 谓词来源，避免两处独立书写导致漂移，保证「仅已发布」不变量一致（R14.2/R14.3、R24.4）。
 */
function publishedArticleConditions(): SQL[] {
  return [
    isNull(post.deletedAt),
    eq(post.type, PostType.ARTICLE),
    eq(post.status, PostStatus.PUBLISHED),
  ];
}

export async function listPublishedArticles(
  params: ListPublishedArticlesParams = {}
): Promise<ListPublishedArticlesResult> {
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? DEFAULT_PUBLISHED_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = publishedArticleConditions();
  if (params.category !== undefined && params.category !== "") {
    conditions.push(like(post.categories, `%${params.category}%`));
  }
  const where = and(...conditions);

  const [totalRow] = await db()
    .select({ value: count() })
    .from(post)
    .where(where);

  const items = await db()
    .select({
      id: post.id,
      slug: post.slug,
      title: post.title,
      description: post.description,
      image: post.image,
      authorName: post.authorName,
      authorImage: post.authorImage,
      categories: post.categories,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    })
    .from(post)
    .where(where)
    .orderBy(desc(post.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total: totalRow?.value ?? 0 };
}

/**
 * 列出**已发布文章并附带正文 `content`**（`type=article` 且 `status=published` 且未软删），
 * 按 `createdAt` 倒序，单次查询取回（不逐篇回读）。
 *
 * 与 {@link listPublishedArticles} 共享同一发布可见性谓词（{@link publishedArticleConditions}），
 * 故「仅已发布」不变量一致（R24.4）；供 SEO 的 llms-full 端点（任务 31）复用，其余投影字段与
 * {@link PublishedArticleItem} 对齐、额外携带 `content`。
 */
export async function listPublishedArticlesWithContent(
  params: PagedParams = {}
): Promise<PublishedArticleWithContent[]> {
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? DEFAULT_PUBLISHED_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  return db()
    .select({
      id: post.id,
      slug: post.slug,
      title: post.title,
      description: post.description,
      image: post.image,
      authorName: post.authorName,
      authorImage: post.authorImage,
      categories: post.categories,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      content: post.content,
    })
    .from(post)
    .where(and(...publishedArticleConditions()))
    .orderBy(desc(post.createdAt))
    .limit(pageSize)
    .offset(offset);
}
