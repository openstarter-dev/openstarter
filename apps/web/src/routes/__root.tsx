import { buildAnalyticsHeadScripts } from "@openstarter/analytics-web/scripts";
import { m } from "@openstarter/i18n-web/messages";
import { getLocale } from "@openstarter/i18n-web/runtime";
import { Toaster } from "@openstarter/ui-web/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { getAnalyticsConfigFn } from "@/functions/analytics";
import { BRAND_NAME } from "@/lib/branding";

import appCss from "../index.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
}

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||((t==='system'||!t)&&m);var c=document.documentElement.classList;c.toggle('dark',d);c.toggle('light',!d);}catch(e){}})();`;

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootDocument,
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: BRAND_NAME },
    ],
    links: [{ href: appCss, rel: "stylesheet" }],
    scripts: buildAnalyticsHeadScripts(loaderData),
  }),
  loader: () => getAnalyticsConfigFn(),
  staleTime: 60 * 1000,
});

function RootDocument() {
  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {/* 键盘用户跳过页头导航直达主内容。 */}
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:px-4 focus:py-2"
          href="#main"
        >
          {m["common.a11y.skip_to_content"]()}
        </a>
        <ThemeProvider>
          <Outlet />
          <Toaster richColors />
        </ThemeProvider>
        {import.meta.env.DEV && (
          <>
            <TanStackRouterDevtools position="bottom-left" />
            <ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
          </>
        )}
        <Scripts />
      </body>
    </html>
  );
}
