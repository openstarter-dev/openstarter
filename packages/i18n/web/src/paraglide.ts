// @openstarter/i18n-web/paraglide —— Paraglide Vite 插件工厂。
// inlang 项目（project.inlang + messages/）、插件依赖与编译产物目录都住在本包：
// apps/web 只传应用侧的构建参数（outputStructure / urlPatterns / strategy），
// 不必再声明 @inlang/paraglide-js，也不必在应用源码树里留生成目录。

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { paraglideVitePlugin } from "@inlang/paraglide-js";

/** 本包内的 inlang 项目根目录（settings.json + messages 的定位点）。 */
export const inlangProjectPath = fileURLToPath(new URL("../project.inlang", import.meta.url));

/**
 * 编译产物目录：包内 src/compiled（git-ignored，由本插件在 dev/build 时写入）。
 * 产物经本包 exports 的 ./runtime、./messages、./middleware 子路径导出，
 * 应用侧因此只依赖包，不依赖任何生成路径。
 */
export const compiledOutdir = fileURLToPath(new URL("./compiled", import.meta.url));

/** Paraglide 插件参数：project 与 outdir 由本包固定，其余由调用方决定。 */
export type ParaglidePluginOptions = Omit<
  Parameters<typeof paraglideVitePlugin>[0],
  "project" | "outdir"
>;

// Paraglide 生成的 client runtime 首行固定是
// `import "@inlang/paraglide-js/urlpattern-polyfill";`。生成文件住在包内、裸包名
// 本可由本包解析，但宿主应用的打包器可能从自己的 root 侧解析该 import（pnpm 严格
// 布局下拿不到本包的依赖），构建期统一重定向到本包内解析出的真实文件——
// 宿主应用因此无需声明 @inlang/paraglide-js。
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
 * 产物目录固定为本包 src/compiled（见 `compiledOutdir`），调用方只决定路由重写规则
 * （urlPatterns）、输出结构与 locale 策略。
 *
 * 返回插件数组：Paraglide 本体 + polyfill 解析重定向（见上），Vite 支持嵌套数组。
 */
export function createParaglidePlugin(options: ParaglidePluginOptions) {
  return [
    paraglideVitePlugin({ project: inlangProjectPath, outdir: compiledOutdir, ...options }),
    urlPatternPolyfillPlugin,
  ];
}
