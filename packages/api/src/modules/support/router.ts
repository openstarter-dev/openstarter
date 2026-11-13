import { Hono } from "hono";

import { ticketsRouter } from "./tickets/router";

export const supportRouter = new Hono().route("/tickets", ticketsRouter);
