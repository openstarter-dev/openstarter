import { m } from "@openstarter/i18n-web/messages";
import { Link, createFileRoute } from "@tanstack/react-router";

import { BlogCard } from "@/components/blog/blog-card";
import { BlogShell } from "@/components/blog/blog-shell";
import { getBlogPostsFn } from "@/functions/blog";
import { collectCategories } from "@/lib/blog";
import { formatBlogDate } from "@/lib/blog-i18n";
import { buildPageHead } from "@/lib/page-head";

type BlogSearch = {
  category?: string;
};

export const Route = createFileRoute("/blog/")({
  validateSearch: (search: Record<string, unknown>): BlogSearch => ({
    category:
      typeof search.category === "string" && search.category !== "" ? search.category : undefined,
  }),
  loaderDeps: ({ search }) => ({ category: search.category }),
  loader: ({ deps }) => getBlogPostsFn({ data: { category: deps.category } }),
  head: () =>
    buildPageHead({
      title: m["blog.title"](),
      description: m["blog.description"](),
      path: "/blog",
    }),
  component: BlogListPage,
});

function BlogListPage() {
  const { locale, items, activeCategory } = Route.useLoaderData();

  const categorySet = new Set(collectCategories(items));
  if (activeCategory) {
    categorySet.add(activeCategory);
  }
  const categories = Array.from(categorySet).sort((a, b) => a.localeCompare(b));

  const activeChip = "bg-foreground text-background";
  const inactiveChip = "bg-muted text-muted-foreground hover:text-foreground";

  return (
    <BlogShell>
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="mb-10 text-center">
          <h1 className="font-bold text-4xl tracking-tight">
            {activeCategory
              ? m["blog.in_category"]({ category: activeCategory })
              : m["blog.title"]()}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">{m["blog.description"]()}</p>
        </div>

        {categories.length > 0 ? (
          <nav
            aria-label={m["blog.categories_label"]()}
            className="mb-10 flex flex-wrap justify-center gap-2"
          >
            <Link
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                activeCategory ? inactiveChip : activeChip
              }`}
              search={{ category: undefined }}
              to="/blog"
            >
              {m["blog.all_posts"]()}
            </Link>
            {categories.map((category) => (
              <Link
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  category === activeCategory ? activeChip : inactiveChip
                }`}
                key={category}
                search={{ category }}
                to="/blog"
              >
                {category}
              </Link>
            ))}
          </nav>
        ) : null}

        {items.length === 0 ? (
          <p className="text-center text-muted-foreground">{m["blog.no_posts"]()}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((post) => (
              <BlogCard
                authorImage={post.authorImage}
                authorName={post.authorName}
                date={formatBlogDate(post.createdAt, locale)}
                description={post.description}
                image={post.image}
                key={post.slug}
                slug={post.slug}
                title={post.title ?? post.slug}
              />
            ))}
          </div>
        )}
      </div>
    </BlogShell>
  );
}
