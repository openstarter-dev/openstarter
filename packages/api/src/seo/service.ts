// packages/api/src/seo/service —— SEO 数据服务（SEO_Module 数据面，R24）。
//
// 为 apps/web 的 SEO 端点（sitemap.xml / llms.txt / llms-full.txt）提供**已发布文章**数据，
// 复用 CMS_Service 的发布可见性查询（见 ../content/posts）：严格仅含 `type=article` 且
// `status=published` 且未软删的文章（R24.4），不暴露草稿 / 下线 / 软删 / 私有内容。
//
// 职责边界：本层仅返回**结构化数据**；最终 XML / 文本渲染由 apps/web 的端点承担
// （见设计「SEO 数据（R24）」——`listPublishedArticles` 提供 URL，apps/web 负责渲染）。
// 时间字段统一以 ISO 8601 字符串返回，消除跨 RPC（JSON）的 Date/字符串歧义。

import {
  listPublishedArticles,
  listPublishedArticlesWithContent,
} from "../content/posts";

// 站点地图 / llms 列举的已发布文章上限。sitemap 单文件 URL 上限为 5 万，此处取足够大的保守值；
// 超出规模的站点应改用分片 sitemap（超出本任务范围）。
const SEO_ARTICLE_LIMIT = 1000;
// llms-full 附带正文的文章上限。正文体量大，取更保守的上限以约束响应规模。
const SEO_FULL_ARTICLE_LIMIT = 200;

/** SEO 文章摘要项（不含正文）：供 sitemap 与 llms.txt 渲染。时间为 ISO 8601 字符串。 */
export type SeoArticle = {
  slug: string;
  title: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

/** SEO 文章全文项：在 {@link SeoArticle} 基础上附带正文，供 llms-full.txt 渲染。 */
export type SeoArticleWithContent = SeoArticle & {
  content: string | null;
};

/**
 * 列出已发布文章摘要（不含正文），按发布时间倒序。仅含已发布内容（R24.4）。
 */
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

/**
 * 列出已发布文章全文（含正文），按发布时间倒序。仅含已发布内容（R24.4）。
 */
export async function listSeoArticlesWithContent(): Promise<
  SeoArticleWithContent[]
> {
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
