// packages/api/src/routes/blog —— 面向读者的**公开只读**博客端点（Blog_Module，R16）。
//
// 与文章**管理**路由（./posts，requireAuth + requirePermission 通配符 RBAC）不同，本路由服务
// 匿名读者，故**不挂**任何鉴权/授权中间件。安全前提：仅暴露**已发布**内容——
//   - `GET /api/blog`：列出已发布文章（可选按分类精确归属筛选、分页）→ 经 Blog_Module 复用
//     CMS 的 `listPublishedArticles`（type=article、status=published、未软删）。
//   - `GET /api/blog/:slug`：取单篇已发布文章 → CMS `findPublishedBySlug`（仅已发布可见）；
//     不存在 / 未发布 / 软删一律返回结构化 404，杜绝草稿/未发布泄露。
//
// 入参经 `zValidator` 校验（不接受可注入的原始查询）；响应沿用统一 `respData`/`respErr` 信封，
// 供 apps/web 经 `hc<AppType>` 类型化 RPC 消费。

import { zValidator } from "@hono/zod-validator";
import { respData, respErr } from "@openstarter/shared";
import { Hono } from "hono";
import { z } from "zod";

import { listBlogArticles } from "../content/blog";
import { findPublishedBySlug } from "../content/posts";

const NOT_FOUND_STATUS = 404;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 12;

const listQuery = z.object({
  category: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

const slugParam = z.object({ slug: z.string().min(1) });

export const blogRoute = new Hono()
  .get("/api/blog", zValidator("query", listQuery), async (c) => {
    const { category, page, pageSize } = c.req.valid("query");
    const { items, total } = await listBlogArticles({
      category,
      page,
      pageSize,
    });
    return c.json(respData({ items, total }));
  })
  .get("/api/blog/:slug", zValidator("param", slugParam), async (c) => {
    const { slug } = c.req.valid("param");
    const article = await findPublishedBySlug(slug);
    if (!article) {
      return c.json(respErr("post not found"), NOT_FOUND_STATUS);
    }
    return c.json(respData(article));
  });
