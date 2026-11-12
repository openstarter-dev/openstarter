import { createFileRoute } from "@tanstack/react-router";

import { buildRobotsTxt, getSiteOrigin, SEO_CACHE_CONTROL } from "@/lib/seo";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = getSiteOrigin(request);
        return new Response(buildRobotsTxt(origin), {
          headers: {
            "Cache-Control": SEO_CACHE_CONTROL,
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      },
    },
  },
});
