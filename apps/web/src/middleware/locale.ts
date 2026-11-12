import { getLocaleFromRequest } from "@openstarter/i18n-web/server";
import { createMiddleware } from "@tanstack/react-start";

export const localeMiddleware = createMiddleware().server(async ({ next, request }) => {
  return next({ context: { locale: getLocaleFromRequest(request) } });
});
