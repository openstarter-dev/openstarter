// @openstarter/i18n-web/paraglide —— Paraglide Vite 插件工厂。
// inlang 项目（project.inlang + messages/）与插件依赖都住在本包：apps/web 只传
// 应用侧的构建参数（outdir / urlPatterns / strategy），不必再声明 @inlang/paraglide-js。

import { fileURLToPath } from "node:url";

import { paraglideVitePlugin } from "@inlang/paraglide-js";

/** 本包内的 inlang 项目根目录（settings.json + messages 的定位点）。 */
export const inlangProjectPath = fileURLToPath(new URL("../project.inlang", import.meta.url));

/** Paraglide 插件参数：project 由本包固定，其余由调用方决定。 */
export type ParaglidePluginOptions = Omit<
  Parameters<typeof paraglideVitePlugin>[0],
  "project"
>;

/**
 * 创建 Paraglide Vite 插件。
 * 调用方决定产物目录（outdir 相对其 Vite root）与路由重写规则（urlPatterns）。
 */
export function createParaglidePlugin(options: ParaglidePluginOptions) {
  return paraglideVitePlugin({ project: inlangProjectPath, ...options });
}
