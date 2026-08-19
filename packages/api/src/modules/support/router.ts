import { Hono } from "hono";

import { apikeysRouter } from "./apikeys/router";
import { ticketsRouter } from "./tickets/router";

export const supportRouter = new Hono()
  .route("/tickets", ticketsRouter)
  .route("/apikeys", apikeysRouter);
