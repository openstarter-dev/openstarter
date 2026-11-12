import { createFileRoute } from "@tanstack/react-router";

import { buildLlmsTxt, fetchSeoArticles, getSiteOrigin, SEO_CACHE_CONTROL } from "@/lib/seo";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = getSiteOrigin(request);
        const articles = await fetchSeoArticles();
        return new Response(buildLlmsTxt(origin, articles), {
          headers: {
            "Cache-Control": SEO_CACHE_CONTROL,
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      },
    },
  },
});
