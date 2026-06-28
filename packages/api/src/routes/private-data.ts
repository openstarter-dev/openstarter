import { Hono } from "hono";

import { authMiddleware } from "../middleware/auth";

export const privateDataRoute = new Hono().get(
  "/api/private-data",
  authMiddleware,
  (c) => {
    const session = c.get("session");
    if (!session) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    return c.json({ message: "This is private", user: session.user });
  }
);
