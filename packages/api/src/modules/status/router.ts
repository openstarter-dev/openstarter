import { respData } from "@openstarter/shared";
import { Hono } from "hono";

const APP_VERSION = "0.1.0";

interface StatusView {
  status: "ok";
  timestamp: string;
  version: string;
}

export const statusRouter = new Hono()
  .get("/health", (c) => c.json({ status: "ok" as const }))
  .get("/status", (c) => {
    const view: StatusView = {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    };
    return c.json(respData(view));
  });
