import { createFileRoute } from "@tanstack/react-router";

import { buildSitemapXml, fetchSeoArticles, getSiteOrigin, SEO_CACHE_CONTROL } from "@/lib/seo";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = getSiteOrigin(request);
        const articles = await fetchSeoArticles();
        return new Response(buildSitemapXml(origin, articles), {
          headers: {
            "Cache-Control": SEO_CACHE_CONTROL,
            "Content-Type": "application/xml; charset=utf-8",
          },
        });
      },
    },
  },
});
