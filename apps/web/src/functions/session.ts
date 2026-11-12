import { createServerFn } from "@tanstack/react-start";

export const getServerSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const [{ auth }, { getRequestHeaders }] = await Promise.all([
    import("@openstarter/auth/server"),
    import("@tanstack/react-start/server"),
  ]);

  const session = await auth.api.getSession({ headers: getRequestHeaders() });

  return { data: session, error: null };
});
