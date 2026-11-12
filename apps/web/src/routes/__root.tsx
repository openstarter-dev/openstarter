import { buildAnalyticsHeadScripts } from "@openstarter/analytics-web/scripts";
import { Toaster } from "@openstarter/ui-web/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { getAnalyticsConfigFn } from "@/functions/analytics";
import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/branding";
import { buildPageHead } from "@/lib/page-head";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import appCss from "../index.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
}

// Runs before hydration to set the theme class and avoid a flash of the wrong theme.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||((t==='system'||!t)&&m);var c=document.documentElement.classList;c.toggle('dark',d);c.toggle('light',!d);}catch(e){}})();`;

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootDocument,
  head: ({ loaderData }) => {
    const pageHead = buildPageHead({
      title: BRAND_NAME,
      description: BRAND_DESCRIPTION,
      path: "/",
    });
    return {
      meta: [
        { charSet: "utf-8" },
        { content: "width=device-width, initial-scale=1", name: "viewport" },
        ...pageHead.meta,
      ],
      links: [{ href: appCss, rel: "stylesheet" }, ...pageHead.links],
      // 依据 Config 供应商标识注入且仅注入对应供应商脚本；未配置则为空数组、不注入（R25.1/R25.2）。
      // 脚本来自受控白名单模板、度量 ID 已校验，经框架 head().scripts 机制注入（非危险 innerHTML）。
      scripts: buildAnalyticsHeadScripts(loaderData),
    };
  },
  // 读取分析供应商配置（SSR），供 head() 依据其条件注入采集脚本（R25.1/R25.2）。
  //
  // staleTime：路由 loader 默认 staleTime=0 —— 父级 match 在每次站内导航时都会被判定为
  // 过期并后台重跑，等于每次点击都多打一次 server fn。分析配置在服务端另有 30s TTL，
  // 60s 的新鲜窗口与缓存语义一致；管理员改配置最多延迟 60s 生效。
  loader: () => getAnalyticsConfigFn(),
  staleTime: 60 * 1000,
});

function RootDocument() {
  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: required pre-hydration theme script to prevent FOUC */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {/* 键盘用户跳过页头导航直达主内容；各布局的 <main> 均携带 id="main"。 */}
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
        {/* DEV 门控：生产构建时 vite 以 false 替换并摇树掉 devtools，不再进客户端包。 */}
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
