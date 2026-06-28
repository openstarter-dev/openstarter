import { createAuth } from "@openstarter/auth";
import { createMiddleware } from "hono/factory";

type Session = Awaited<
  ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>
>;

export const authMiddleware = createMiddleware<{
  Variables: { session: Session };
}>(async (c, next) => {
  const session = await createAuth().api.getSession({
    headers: c.req.raw.headers,
  });
  c.set("session", session);
  await next();
});
