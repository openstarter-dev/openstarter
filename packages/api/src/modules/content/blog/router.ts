import { respData, respErr } from "@openstarter/shared";
import { Hono } from "hono";

import { zValidator } from "../../../lib/validator";
import { listBlogArticles } from "../blog";
import { findPublishedBySlug } from "../posts";
import { listQuery, slugParam } from "../../../schema/content/blog";

const NOT_FOUND_STATUS = 404;

export const blogRouter = new Hono()
  .get("/", zValidator("query", listQuery), async (c) => {
    const { category, page, pageSize } = c.req.valid("query");
    const { items, total } = await listBlogArticles({
      category,
      page,
      pageSize,
    });
    return c.json(respData({ items, total }));
  })
  .get("/:slug", zValidator("param", slugParam), async (c) => {
    const { slug } = c.req.valid("param");
    const article = await findPublishedBySlug(slug);
    if (!article) {
      return c.json(respErr("post not found"), NOT_FOUND_STATUS);
    }
    return c.json(respData(article));
  });
