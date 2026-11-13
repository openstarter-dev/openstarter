import { listPublishedArticles, listPublishedArticlesWithContent } from "../posts";

const SEO_ARTICLE_LIMIT = 1000;
const SEO_FULL_ARTICLE_LIMIT = 200;

export type SeoArticle = {
  slug: string;
  title: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SeoArticleWithContent = SeoArticle & {
  content: string | null;
};

export async function listSeoArticles(): Promise<SeoArticle[]> {
  const { items } = await listPublishedArticles({
    page: 1,
    pageSize: SEO_ARTICLE_LIMIT,
  });
  return items.map((item) => ({
    slug: item.slug,
    title: item.title,
    description: item.description,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
}

export async function listSeoArticlesWithContent(): Promise<SeoArticleWithContent[]> {
  const items = await listPublishedArticlesWithContent({
    page: 1,
    pageSize: SEO_FULL_ARTICLE_LIMIT,
  });
  return items.map((item) => ({
    slug: item.slug,
    title: item.title,
    description: item.description,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    content: item.content,
  }));
}
