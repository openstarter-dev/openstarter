import { Hono } from "hono";

import { blogRouter } from "./blog/router";
import { postsRouter } from "./posts/router";
import { seoRouter } from "./seo/router";
import { taxonomyRouter } from "./taxonomy/router";

export const contentRouter = new Hono()
  .route("/posts", postsRouter)
  .route("/blog", blogRouter)
  .route("/taxonomy", taxonomyRouter)
  .route("/seo", seoRouter);