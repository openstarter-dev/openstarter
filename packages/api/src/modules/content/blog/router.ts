import { zValidator } from "@hono/zod-validator";
import { respData, respErr } from "@openstarter/shared";
import { Hono } from "hono";
import { z } from "zod";

import { listBlogArticles } from "../blog";
import { findPublishedBySlug } from "../posts";
import { createPaginationSchema } from "../../../schema";

const NOT_FOUND_STATUS = 404;

const listQuery = createPaginationSchema(100, 12).extend({
  category: z.string().min(1).optional(),
});

const slugParam = z.object({ slug: z.string().min(1) });

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
