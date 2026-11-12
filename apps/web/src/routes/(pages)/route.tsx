import { MDXProvider } from "@mdx-js/react";
import { Outlet, createFileRoute } from "@tanstack/react-router";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { mdxComponents } from "@/components/mdx-components";

export const Route = createFileRoute("/(pages)")({
  component: PagesLayout,
});

function PagesLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <MarketingHeader />
      <main id="main" className="flex-1">
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
