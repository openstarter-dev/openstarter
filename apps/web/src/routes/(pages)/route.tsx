import { MDXProvider } from "@mdx-js/react";
import { Outlet, createFileRoute } from "@tanstack/react-router";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { mdxComponents } from "@/components/mdx-components";

export const Route = createFileRoute("/(pages)")({
  component: PagesLayout,
});

// Shared shell for MDX static pages (privacy, terms, ...). Reuses the site
// header/footer and exposes a single <main>, so dropping a new `.mdx` page in
// this group inherits the layout without touching any server logic.
function PagesLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-16">
          <MDXProvider components={mdxComponents}>
            <Outlet />
          </MDXProvider>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
