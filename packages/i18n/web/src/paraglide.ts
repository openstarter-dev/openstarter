// @openstarter/i18n-web/paraglide —— Paraglide Vite 插件工厂。
// inlang 项目（project.inlang + messages/）与插件依赖都住在本包：apps/web 只传
// 应用侧的构建参数（outdir / urlPatterns / strategy），不必再声明 @inlang/paraglide-js。

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { paraglideVitePlugin } from "@inlang/paraglide-js";

/** 本包内的 inlang 项目根目录（settings.json + messages 的定位点）。 */
export const inlangProjectPath = fileURLToPath(new URL("../project.inlang", import.meta.url));

/** Paraglide 插件参数：project 由本包固定，其余由调用方决定。 */
export type ParaglidePluginOptions = Omit<
  Parameters<typeof paraglideVitePlugin>[0],
  "project"
>;

// Paraglide 生成的 client runtime 首行固定是
// `import "@inlang/paraglide-js/urlpattern-polyfill";`。该裸包名由宿主应用里
// 的生成文件发起，pnpm 严格布局下宿主解析不到本包的依赖，所以在构建期把它
// 重定向到本包内解析出的真实文件——宿主应用因此无需声明 @inlang/paraglide-js。
const urlPatternPolyfillId = "@inlang/paraglide-js/urlpattern-polyfill";
const urlPatternPolyfillPath = createRequire(import.meta.url).resolve(urlPatternPolyfillId);

const urlPatternPolyfillPlugin = {
  name: "openstarter:paraglide-urlpattern-polyfill",
  enforce: "pre" as const,
  resolveId(source: string) {
    return source === urlPatternPolyfillId ? urlPatternPolyfillPath : null;
  },
};

/**
 * 创建 Paraglide Vite 插件。
 * 调用方决定产物目录（outdir 相对其 Vite root）与路由重写规则（urlPatterns）。
 *
 * 返回插件数组：Paraglide 本体 + polyfill 解析重定向（见上），Vite 支持嵌套数组。
 */
export function createParaglidePlugin(options: ParaglidePluginOptions) {
  return [
    paraglideVitePlugin({ project: inlangProjectPath, ...options }),
    urlPatternPolyfillPlugin,
  ];
}
