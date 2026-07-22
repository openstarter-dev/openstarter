// packages/api/src/routes/seo —— SEO 数据端点（SEO_Module 数据面，R24）。
//
// 面向搜索引擎 / 大模型抓取工具的**公开只读**数据端点，故**不挂**鉴权/授权中间件；安全前提：
// 仅暴露**已发布**文章（经 SEO 服务复用 CMS 的发布可见性查询，R24.4），不含草稿 / 私有内容
// （对齐「网络暴露提示」——新增公开端点为只读且不含敏感数据）。
//
// apps/web 的 sitemap.xml / llms.txt / llms-full.txt 端点经类型化 RPC（AppType）消费本数据并
// 渲染最终 XML / 文本；本层不感知渲染细节。
//   - `GET /api/seo/articles`      → 已发布文章摘要（sitemap + llms.txt 复用，不含正文）。
//   - `GET /api/seo/articles/full` → 已发布文章全文（llms-full.txt 复用，含正文）。

import { respData } from "@openstarter/shared";
import { Hono } from "hono";

import { listSeoArticles, listSeoArticlesWithContent } from "../seo/service";

export const seoRoute = new Hono()
  .get("/api/seo/articles", async (c) => {
    const items = await listSeoArticles();
    return c.json(respData({ items }));
  })
  .get("/api/seo/articles/full", async (c) => {
    const items = await listSeoArticlesWithContent();
    return c.json(respData({ items }));
  });
