import { createFileRoute } from "@tanstack/react-router";

import {
  buildLlmsFullTxt,
  fetchSeoArticlesWithContent,
  getSiteOrigin,
  SEO_CACHE_CONTROL,
} from "@/lib/seo";

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = getSiteOrigin(request);
        const articles = await fetchSeoArticlesWithContent();
        return new Response(buildLlmsFullTxt(origin, articles), {
          headers: {
            "Cache-Control": SEO_CACHE_CONTROL,
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      },
    },
  },
});
