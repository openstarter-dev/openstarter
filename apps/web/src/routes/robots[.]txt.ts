// robots.txt 端点（SEO_Module，R24.2）。
//
// 服务端 GET handler：输出 robots 规则文本，屏蔽鉴权/私有区与 API，并声明 sitemap 地址
// （基址从请求派生）。`Content-Type: text/plain`。

import { createFileRoute } from "@tanstack/react-router";

import { buildRobotsTxt, getSiteOrigin } from "@/lib/seo";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = getSiteOrigin(request);
        return new Response(buildRobotsTxt(origin), {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
