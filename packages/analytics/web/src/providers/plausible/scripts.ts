// Plausible —— 采集脚本模板。
//
// 初始化桩为静态字符串（无插值）；域名与脚本 URL 作为 <script> 属性透传，
// 其校验/归一在 ./index.ts 调用 ../../validators 完成。

import type { HeadScript } from "../../internal/types";

const INIT_SCRIPT_ID = "plausible-init";
const LOADER_SCRIPT_ID = "plausible-loader";

/** Plausible 脚本模板：初始化桩（静态、无插值）+ 加载器（域名/URL 作为属性透传）。 */
export function plausibleScripts(domain: string, src: string): HeadScript[] {
  return [
    {
      children:
        "window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};",
      id: INIT_SCRIPT_ID,
    },
    {
      async: true,
      "data-domain": domain,
      defer: true,
      id: LOADER_SCRIPT_ID,
      src,
    },
  ];
}
