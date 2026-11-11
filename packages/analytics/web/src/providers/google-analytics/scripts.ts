// Google Analytics（gtag.js）—— 采集脚本模板。
//
// 纯模板构造：不触碰 DOM、不做配置判定（判定归 ../../validators + ./index.ts）。
// 输出交给 TanStack Router 的 head().scripts 注入，SSR 期由框架统一管理 <script> 标签。

import type { HeadScript } from "../../internal/types";

const LOADER_SCRIPT_ID = "ga-loader";
const INIT_SCRIPT_ID = "ga-init";

/** Google Analytics（gtag.js）脚本模板：加载器 + 初始化（度量 ID 已校验，安全插值）。 */
export function googleAnalyticsScripts(measurementId: string): HeadScript[] {
  return [
    {
      async: true,
      id: LOADER_SCRIPT_ID,
      src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
    },
    {
      children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}');`,
      id: INIT_SCRIPT_ID,
    },
  ];
}
