// 博客页面外壳：复用站点营销页头/页脚，包裹单一语义化 <main>。
// 博客为顶层路由（非 _marketing 布局子级），由本组件提供统一页头/页脚，
// 避免 404（NotFound 组件自带 <main>）时出现嵌套 main 的可访问性问题。

import type { ReactNode } from "react";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";

export function BlogShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
