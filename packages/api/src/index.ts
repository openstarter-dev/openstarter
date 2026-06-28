import { createAuth } from "@openstarter/auth";
import { Hono } from "hono";

import { healthRoute } from "./routes/health";
import { privateDataRoute } from "./routes/private-data";

const app = new Hono();

app.on(["POST", "GET"], "/api/auth/*", (c) => createAuth().handler(c.req.raw));

const routes = app.route("/", healthRoute).route("/", privateDataRoute);

export { app };
export type AppType = typeof routes;
