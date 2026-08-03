// 博客详情页（R16.2 / R16.4 / R16.5）。
//
// SSR 经 RPC 调 GET /api/blog/:slug 渲染正文与元信息；文章不存在或未发布时抛 TanStack Router
// 的 notFound()，由路由 notFoundComponent 渲染既有 NotFound 组件并返回 404。文案依当前 locale。
//
// 正文渲染：当前以保留换行的纯文本安全呈现（不注入原始 HTML，避免 XSS）；富文本/MDX 渲染属
// 静态页任务（任务 24）范畴，暂不在此引入渲染依赖。

import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { BlogShell } from "@/components/blog/blog-shell";
import { NotFound } from "@/components/system/not-found";
import { getBlogPostFn } from "@/functions/blog";
import { formatBlogDate } from "@/lib/blog-i18n";
import { buildPageHead } from "@/lib/page-head";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const result = await getBlogPostFn({ data: { slug: params.slug } });
    if (!result.post) {
      throw notFound();
    }
    return { locale: result.locale, post: result.post };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {};
    }
    const { post } = loaderData;
    return buildPageHead({
      title: post.title ?? post.slug,
      description: post.description ?? undefined,
      image: post.image ?? undefined,
      path: `/blog/${post.slug}`,
      type: "article",
    });
  },
  notFoundComponent: () => <NotFound />,
  component: BlogPostPage,
});

function BlogPostPage() {
  const { locale, post } = Route.useLoaderData();
  const title = post.title ?? post.slug;

  return (
    <BlogShell>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <Link
          className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
          to="/blog"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {m["blog.back_to_blog"]()}
        </Link>

        <header className="mt-8 border-b pb-6">
          <h1 className="font-semibold text-3xl tracking-tight md:text-4xl">
            {title}
          </h1>
          {post.description ? (
            <p className="mt-3 text-muted-foreground">{post.description}</p>
          ) : null}
          <div className="mt-4 flex items-center gap-3 text-muted-foreground text-sm">
            <time>{formatBlogDate(post.createdAt, locale)}</time>
            {post.authorName ? (
              <span className="inline-flex items-center gap-2">
                {post.authorImage ? (
                  <img
                    alt=""
                    className="size-5 rounded-full object-cover"
                    src={post.authorImage}
                  />
                ) : null}
                {post.authorName}
              </span>
            ) : null}
          </div>
        </header>

        {post.image ? (
          <img
            alt={title}
            className="mt-8 w-full rounded-2xl border object-cover"
            src={post.image}
          />
        ) : null}

        {post.content ? (
          <div className="mt-8 whitespace-pre-wrap text-[15px] text-foreground/90 leading-7">
            {post.content}
          </div>
        ) : null}
      </article>
    </BlogShell>
  );
}
