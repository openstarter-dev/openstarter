// packages/api/src/content/blog —— 面向读者的博客展示服务（Blog_Module，R16）。
//
// 复用 CMS_Service 的发布可见性查询（`listPublishedArticles`/`findPublishedBySlug`，见 ./posts），
// 在其之上补齐**按分类精确归属**的列表筛选（R16.3 / Property 35）。CMS 的 `listPublishedArticles`
// 对 `categories` 文本字段做的是**包含匹配**（`LIKE %category%`），可能过匹配（如 "tech" 命中
// "fintech"）；本模块在应用层对 `categories` 的实际存储格式做**精确归属**判断，确保「按分类筛选时
// 返回的每一篇文章都归属该分类且已发布」。
//
// 安全：仅经 CMS_Service 的**已发布**查询取数（草稿/下线/软删不可见），本模块不新增任何可绕过
// 发布可见性的读取路径。

import { listPublishedArticles, type PublishedArticleItem } from "./posts";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;

// 施加分类筛选时，扫描的已发布文章候选上限。`categories` 为自由文本列，跨方言无法用可移植 SQL
// 表达「精确归属」，故在应用层对**有界**候选集做精确判断（博客量级足够）。Property 35 只要求
// 返回项均「归属该分类且已发布」——由应用层精确过滤保证；上限用于约束一次筛选的扫描规模。
const CATEGORY_CANDIDATE_CAP = 500;

// 分类分隔符：兼容逗号 / 分号分隔的文本存储格式。
const CATEGORY_DELIMITERS = /[,;]/;

/**
 * 将 `categories` 文本解析为分类词元数组。
 *
 * 兼容两类存储格式：
 *   - JSON 数组（如 `["tech","news"]`）——仅保留字符串元素；
 *   - 逗号 / 分号分隔（如 `tech, news`）。
 *
 * 各词元去除首尾空白并剔除空串；无法解析或为空时返回空数组。
 */
export function parsePostCategories(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return [];
  }
  if (trimmed.startsWith("[")) {
    const parsed = parseJsonCategories(trimmed);
    if (parsed) {
      return parsed;
    }
  }
  return splitDelimited(trimmed);
}

function parseJsonCategories(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item !== "");
  } catch {
    return null;
  }
}

function splitDelimited(value: string): string[] {
  return value
    .split(CATEGORY_DELIMITERS)
    .map((token) => token.trim())
    .filter((token) => token !== "");
}

/**
 * 判定某篇文章是否**精确归属**给定分类（大小写无关的整词匹配，非子串包含）。
 *
 * 例：`categories="fintech"` 不归属分类 `"tech"`；`categories="tech,news"` 归属 `"tech"`。
 */
export function postBelongsToCategory(raw: string | null | undefined, category: string): boolean {
  const target = category.trim().toLowerCase();
  if (target === "") {
    return false;
  }
  return parsePostCategories(raw).some((token) => token.toLowerCase() === target);
}

/** 博客列表筛选入参。`category` 为可选分类（精确归属）；分页从 1 起。 */
export type ListBlogArticlesParams = {
  category?: string;
  page?: number;
  pageSize?: number;
};

/** 博客列表返回：已发布文章投影项与总数（与 `respPage`/`PageData` 结构一致）。 */
export type ListBlogArticlesResult = {
  items: PublishedArticleItem[];
  total: number;
};

/**
 * 列出已发布博客文章（R16.1）；提供 `category` 时**仅返回精确归属该分类**的文章（R16.3）。
 *
 * - 无分类：直接透传 CMS 的 `listPublishedArticles` 分页（已发布可见性由其保证）。
 * - 有分类：从已发布集合取**有界候选**（不下推易过匹配/大小写敏感的 `LIKE`，改由应用层精确
 *   过滤），按 {@link postBelongsToCategory} 精确归属过滤后再在内存分页，`total` 为精确匹配总数。
 */
export async function listBlogArticles(
  params: ListBlogArticlesParams = {},
): Promise<ListBlogArticlesResult> {
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const category = params.category?.trim();

  if (!category) {
    return listPublishedArticles({ page, pageSize });
  }

  const { items } = await listPublishedArticles({
    page: DEFAULT_PAGE,
    pageSize: CATEGORY_CANDIDATE_CAP,
  });
  const matched = items.filter((item) => postBelongsToCategory(item.categories, category));
  const offset = (page - 1) * pageSize;
  return {
    items: matched.slice(offset, offset + pageSize),
    total: matched.length,
  };
}
