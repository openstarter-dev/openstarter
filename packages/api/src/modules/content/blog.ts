import { listPublishedArticles, type PublishedArticleItem } from "./posts";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;

const CATEGORY_CANDIDATE_CAP = 500;

const CATEGORY_DELIMITERS = /[,;]/;

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

export function postBelongsToCategory(raw: string | null | undefined, category: string): boolean {
  const target = category.trim().toLowerCase();
  if (target === "") {
    return false;
  }
  return parsePostCategories(raw).some((token) => token.toLowerCase() === target);
}

export type ListBlogArticlesParams = {
  category?: string;
  page?: number;
  pageSize?: number;
};

export type ListBlogArticlesResult = {
  items: PublishedArticleItem[];
  total: number;
};

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
