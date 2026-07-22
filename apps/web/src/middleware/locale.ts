// 服务端 locale 中间件：依 @openstarter/i18n/server 的解析顺序（URL 前缀 / cookie /
// Accept-Language / 默认语言）确定当前请求语言，注入 server function 的 context。
// 供博客等 SSR 数据加载按当前 locale 渲染界面文案（R16.5）。

import { getLocaleFromRequest } from "@openstarter/i18n/server";
import { createMiddleware } from "@tanstack/react-start";

export const localeMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    return next({ context: { locale: getLocaleFromRequest(request) } });
  }
);
