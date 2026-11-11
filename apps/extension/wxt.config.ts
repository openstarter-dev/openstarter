import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { type Plugin, transformWithOxc } from "vite";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "wxt";

import { EXTENSION_DEFAULT_LOCALE } from "@openstarter/i18n-extension";

// 加载 apps/web/.env（全仓库唯一 env 事实源），把 web 应用地址派生为 VITE_APP_URL。
// host_permissions 与 API base URL 都由 VITE_APP_URL 派生，二者不会漂移
// （见 docs/superpowers/specs/2026-08-01-browser-extension-app-design.md §5）。
// manifest 支持函数形式（(env) => manifest），故可在构建期读取 process.env。
//
// 优先级（高 → 低）：显式 process.env.VITE_APP_URL（CI/shell 覆盖）>
// OPENSTARTER_API_URL（显式覆盖）> apps/web/.env 的 URL（web 应用地址，也是 API 源）>
// BETTER_AUTH_URL > localhost 兜底。Wxt 只在 Node 构建期读本文件，不向上遍历
// monorepo，故需手动加载 apps/web/.env。
const extensionDir = resolve(fileURLToPath(import.meta.url), "..");
const webEnvFile = resolve(extensionDir, "..", "web", ".env");
const require = createRequire(import.meta.url);
const dotenvPath = require.resolve("dotenv", { paths: [extensionDir] });
const { config: loadDotenv } = await import(dotenvPath);
loadDotenv({ path: webEnvFile, quiet: true });

const APP_URL_FALLBACK = "http://localhost:3000";

// 插件端 i18n：@wxt-dev/i18n（browser.i18n 封装）。消息目录在
// packages/i18n/extension/locales（插件专属精简目录，与 web 端 Paraglide 目录独立），
// 构建期由该模块编译为 _locales/<locale>/messages.json 并生成 #i18n 的类型安全 i18n.t。
// 语言跟随浏览器 UI 语言 —— browser.i18n 不支持运行时切换，也不读 web 端 locale cookie
// （用户确认的取舍）；localesDir 必须是绝对路径（模块内部不基于 config 解析相对路径）。
const extensionLocalesDir = resolve(extensionDir, "../../packages/i18n/extension/locales");

// vite-plugin-svgr 把 .svg 转成内含 JSX 的 React 组件源码，但 Vite 的 JSX 编译管线
// 只处理 .jsx/.tsx，不会回头编译 .svg 模块 —— 该插件对 svgr 的输出做第二次编译，
// 否则产物里是裸 JSX 语法，浏览器直接报语法错误。
// runtime: "classic" 编译为 React.createElement，依赖 svgr 默认模板注入的
// `import * as React from "react"`；id.split("?")[0] 剥掉 ?url 等查询串，
// ?? 兜底是 noUncheckedIndexedAccess（.wxt/tsconfig.json 已开启）的要求。
const svgJsxTransformPlugin = (): Plugin => ({
  enforce: "post",
  name: "extension-svg-jsx-transform",
  async transform(code, id) {
    const path = id.split("?")[0] ?? id;

    if (!path.endsWith(".svg")) {
      return null;
    }

    const result = await transformWithOxc(code, id, {
      lang: "jsx",
      jsx: {
        runtime: "classic",
      },
    });

    return {
      code: result.code,
      map: null,
    };
  },
});

function resolveAppUrl(): string {
  if (process.env.VITE_APP_URL) {
    return process.env.VITE_APP_URL;
  }
  if (process.env.OPENSTARTER_API_URL) {
    return process.env.OPENSTARTER_API_URL;
  }
  if (process.env.URL) {
    return process.env.URL;
  }
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }
  return APP_URL_FALLBACK;
}

export default defineConfig({
  // HMR server 固定 1234：dev:web 已占用 3000，默认的 getPort(3000, [3001..3010])
  // 会落在随环境漂移的端口；strictPort 让 1234 被占时直接报错而非悄悄换端口。
  dev: {
    server: {
      port: 1234,
      strictPort: true,
    },
  },
  // 禁用 web-ext 自动拉起浏览器（monorepo 下常与系统默认浏览器配置打架）；
  // HMR 不受影响 —— 推送靠产物内建的 dev server websocket，加载 unpacked 产物仍需手动。
  webExt: {
    disabled: true,
  },
  manifest: () => {
    const appUrl = resolveAppUrl();
    const { origin } = new URL(appUrl);
    return {
      default_locale: EXTENSION_DEFAULT_LOCALE,
      // 最小权限：单一 origin，跟随 API 地址派生。不引入 <all_urls>
      // （见 spec §2 浏览器范围决策 —— 仅 Chromium 系，也不加 gecko 段）。
      host_permissions: [`${origin}/*`],
      name: "OpenStarter Account",
      permissions: ["cookies"],
    };
  },
  // wxt module 在 "@wxt-dev/i18n/module" 子导出（根入口是运行时 createI18n，无 default module 导出）。
  // @wxt-dev/auto-icons 从 src/assets/icon.png 生成 16/32/48/128 全尺寸 manifest 图标。
  modules: ["@wxt-dev/module-react", "@wxt-dev/i18n/module", "@wxt-dev/auto-icons"],
  srcDir: "src",
  i18n: {
    localesDir: extensionLocalesDir,
  },
  // 关闭 unimport 自动导入：代码已全部显式 import（wxt/browser、defineBackground 等，
  // 见 spec 测试策略 —— 依赖显式注入）。显式化换来更好的跳转与类型体验。
  imports: false,
  vite: () => ({
    plugins: [
      // 与 apps/web 同一条 Tailwind v4 管线（@openstarter/ui-web/globals.css）。
      // 扩展此前未接该插件，产物 CSS 里 @tailwind 指令未编译、工具类全缺。
      tailwindcss(),
      svgr({
        include: "**/*.svg",
      }),
      svgJsxTransformPlugin(),
    ],
    // pnpm workspace + @openstarter/ui-web 复用场景下防双 React 实例
    //（双实例会让 hooks 直接抛错），版本都走 catalog，此为廉价保险。
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  }),
});
