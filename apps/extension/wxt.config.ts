import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { type Plugin, transformWithOxc } from "vite";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "wxt";

import { EXTENSION_DEFAULT_LOCALE } from "@openstarter/i18n-extension";

const extensionDir = resolve(fileURLToPath(import.meta.url), "..");
const webEnvFile = resolve(extensionDir, "..", "web", ".env");
const require = createRequire(import.meta.url);
const dotenvPath = require.resolve("dotenv", { paths: [extensionDir] });
const { config: loadDotenv } = await import(dotenvPath);
loadDotenv({ path: webEnvFile, quiet: true });

const APP_URL_FALLBACK = "http://localhost:3000";

const extensionLocalesDir = resolve(extensionDir, "../../packages/i18n/extension/locales");

// vite-plugin-svgr 把 .svg 转成内含 JSX 的 React 组件源码，但 Vite 的 JSX 编译管线
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
  return APP_URL_FALLBACK;
}

export default defineConfig({
  dev: {
    server: {
      port: 1234,
      strictPort: true,
    },
  },
  webExt: {
    disabled: true,
  },
  manifest: () => {
    const appUrl = resolveAppUrl();
    const { origin } = new URL(appUrl);
    return {
      default_locale: EXTENSION_DEFAULT_LOCALE,
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
  imports: false,
  vite: () => ({
    plugins: [
      tailwindcss(),
      svgr({
        include: "**/*.svg",
      }),
      svgJsxTransformPlugin(),
    ],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  }),
});
