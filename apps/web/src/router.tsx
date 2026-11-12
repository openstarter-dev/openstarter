import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { deLocalizeUrl, localizeUrl } from "@/paraglide/runtime.js";

import Loader from "./components/loader";
import { ErrorPage } from "./components/system/error";
import { NotFound } from "./components/system/not-found";
import { routeTree } from "./routeTree.gen";

function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // 已有数据的后台刷新失败不再弹 toast：界面仍展示旧数据，逐次弹窗只会造成噪音。
        if (query.state.data !== undefined) {
          return;
        }
        // 路由 loader 的 prefetchQuery 没有活跃 observer，失败只在真正挂载的组件里
        // 以 error 态呈现；hover 预取失败若仍弹窗，用户会收到指向未曾打开页面的报错。
        if (query.getObserversCount() === 0) {
          return;
        }
        // 不透传原始 error.message（可能泄漏内部实现/网络细节）；
        // 仅 DEV 环境保留原始信息便于排查。
        const message = import.meta.env.DEV ? error.message : m["common.error.message"]();
        toast.error(message, {
          action: {
            label: m["common.error.retry"](),
            onClick: () => {
              void query.invalidate();
            },
          },
        });
      },
    }),
    // staleTime: 窗口聚焦仅重拉已过期数据（staleTime 内命中缓存）。refetchOnWindowFocus
    // 显式关闭:避免切回标签页时对已展示数据的无谓重拉,结合 staleTime 行为更可预期。
    defaultOptions: {
      queries: {
        // 默认 3 次指数退避（1s/2s/4s，≈7s）期间页面一直转圈，且 4xx 也被无意义重试。
        // 携带 status 的 4xx 直接失败；其余（网络错误 / 5xx）最多重试 1 次。
        retry: (failureCount, error) => {
          const status = (error as { status?: unknown }).status;
          if (typeof status === "number" && status >= 400 && status < 500) {
            return false;
          }
          return failureCount < 1;
        },
        retryDelay: 500,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export const getRouter = () => {
  const queryClient = createQueryClient();

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    // Link 悬停/聚焦时预加载目标路由（intent）；配合 staleTime:0 让预加载的数据始终最新。
    // defaultPreloadDelay 防抖：避免鼠标快速划过多个链接时触发多余预取。
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 0,
    context: { queryClient },
    // Paraglide owns locale prefixes: incoming URLs are de-localized before
    // route matching (the route tree is locale-free) and outgoing hrefs are
    // re-localized, so links stay locale-agnostic and resolve to the active
    // locale automatically (R23.3, R23.4).
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
    defaultPendingComponent: () => <Loader />,
    // 默认 1000ms 才显示 pending：客户端专属路由（admin、settings 等）在慢网络下
    // 会白屏近 1 秒。200ms 起步 + 至少停留 300ms，兼顾「早反馈」与「不闪一下」。
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
    defaultNotFoundComponent: () => <NotFound />,
    defaultErrorComponent: ({ error }) => <ErrorPage error={error} />,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
