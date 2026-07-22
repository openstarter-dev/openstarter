// llms.txt 端点（SEO_Module，R24.3）。
//
// 服务端 GET handler：输出描述站点内容的大模型可读文本（站点概览 + 公开页面与已发布文章清单，
// 不含正文）。文章经类型化 RPC 复用 CMS 的 `listPublishedArticles`（仅已发布，R24.4）。
// `Content-Type: text/plain`。

import { createFileRoute } from "@tanstack/react-router";

import { buildLlmsTxt, fetchSeoArticles, getSiteOrigin } from "@/lib/seo";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = getSiteOrigin(request);
        const articles = await fetchSeoArticles();
        return new Response(buildLlmsTxt(origin, articles), {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
