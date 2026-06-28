import { Hono } from "hono";

export const healthRoute = new Hono().get("/api/health", (c) =>
  c.json({ status: "ok" as const })
);
