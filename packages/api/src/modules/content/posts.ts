import { type NewPost, type Post, post } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { and, count, desc, eq, isNull, like, or, type SQL } from "drizzle-orm";

import { SlugConflictError } from "./errors";
import { PostStatus, PostType } from "../../schema/content/posts";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PUBLISHED_PAGE_SIZE = 100;

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

export type ListPostsParams = {
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ListPostsResult = {
  items: Post[];
  total: number;
};

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

export type ListPublishedArticlesParams = {
  category?: string;
  page?: number;
  pageSize?: number;
};

export type ListPublishedArticlesResult = {
  items: PublishedArticleItem[];
  total: number;
};

export type PublishedArticleWithContent = PublishedArticleItem & {
  content: string | null;
};

export type PagedParams = {
  page?: number;
  pageSize?: number;
};

async function assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
  const [existing] = await db()
    .select({ id: post.id })
    .from(post)
    .where(eq(post.slug, slug))
    .limit(1);
  if (existing && existing.id !== excludeId) {
    throw new SlugConflictError(slug);
  }
}

export async function getPostById(id: string): Promise<Post | undefined> {
  const [result] = await db()
    .select()
    .from(post)
    .where(and(eq(post.id, id), isNull(post.deletedAt)))
    .limit(1);
  return result;
}

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

export async function updatePost(id: string, input: UpdatePostInput): Promise<Post | undefined> {
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

export async function deletePost(id: string): Promise<void> {
  await db()
    .update(post)
    .set({ status: PostStatus.ARCHIVED, deletedAt: new Date() })
    .where(and(eq(post.id, id), isNull(post.deletedAt)));
}

export async function listPosts(params: ListPostsParams): Promise<ListPostsResult> {
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

  const [totalRow] = await db().select({ value: count() }).from(post).where(where);

  const items = await db()
    .select()
    .from(post)
    .where(where)
    .orderBy(desc(post.updatedAt), desc(post.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total: totalRow?.value ?? 0 };
}

export async function findPublishedBySlug(slug: string): Promise<Post | undefined> {
  const [result] = await db()
    .select()
    .from(post)
    .where(
      and(
        eq(post.slug, slug.toLowerCase()),
        eq(post.status, PostStatus.PUBLISHED),
        isNull(post.deletedAt),
      ),
    )
    .limit(1);
  return result;
}

function publishedArticleConditions(): SQL[] {
  return [
    isNull(post.deletedAt),
    eq(post.type, PostType.ARTICLE),
    eq(post.status, PostStatus.PUBLISHED),
  ];
}

export async function listPublishedArticles(
  params: ListPublishedArticlesParams = {},
): Promise<ListPublishedArticlesResult> {
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? DEFAULT_PUBLISHED_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = publishedArticleConditions();
  if (params.category !== undefined && params.category !== "") {
    conditions.push(like(post.categories, `%${params.category}%`));
  }
  const where = and(...conditions);

  const [totalRow] = await db().select({ value: count() }).from(post).where(where);

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

export async function listPublishedArticlesWithContent(
  params: PagedParams = {},
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
