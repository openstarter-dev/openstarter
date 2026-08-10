import { respData } from "@openstarter/shared";
import { Hono } from "hono";

import { listSeoArticles, listSeoArticlesWithContent } from "./service";

export const seoRouter = new Hono()
  .get("/articles", async (c) => {
    const items = await listSeoArticles();
    return c.json(respData({ items }));
  })
  .get("/articles/full", async (c) => {
    const items = await listSeoArticlesWithContent();
    return c.json(respData({ items }));
  });