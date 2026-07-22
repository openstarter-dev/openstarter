// sitemap.xml 端点（SEO_Module，R24.1、R24.4）。
//
// 服务端 GET handler：输出公开页面 + **已发布**文章 URL 的合法站点地图。文章数据经类型化 RPC
// 复用 CMS 的 `listPublishedArticles`（仅已发布，R24.4）；locale 感知由 `buildSitemapXml`
// 以 hreflang alternates 表达规范 URL，避免重复本地化前缀。`Content-Type: application/xml`。

import { createFileRoute } from "@tanstack/react-router";

import { buildSitemapXml, fetchSeoArticles, getSiteOrigin } from "@/lib/seo";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = getSiteOrigin(request);
        const articles = await fetchSeoArticles();
        return new Response(buildSitemapXml(origin, articles), {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
