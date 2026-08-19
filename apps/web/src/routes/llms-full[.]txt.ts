// llms-full.txt 端点（SEO_Module，R24.3）。
//
// 服务端 GET handler：输出描述站点内容的大模型可读文本，**含已发布文章全文**。文章全文经类型化
// RPC 复用 CMS 的 `listPublishedArticlesWithContent`（仅已发布，R24.4）。`Content-Type: text/plain`。

import { createFileRoute } from "@tanstack/react-router";

import { buildLlmsFullTxt, fetchSeoArticlesWithContent, getSiteOrigin } from "@/lib/seo";

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = getSiteOrigin(request);
        const articles = await fetchSeoArticlesWithContent();
        return new Response(buildLlmsFullTxt(origin, articles), {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
