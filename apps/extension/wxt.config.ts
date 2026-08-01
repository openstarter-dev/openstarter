import { defineConfig } from "wxt";

// host_permissions 与 API base URL 都由 VITE_APP_URL 派生，二者不会漂移
// （见 docs/superpowers/specs/2026-08-01-browser-extension-app-design.md §5）。
// manifest 支持函数形式（(env) => manifest），故可在构建期读取 process.env。
export default defineConfig({
  manifest: () => {
    const appUrl = process.env.VITE_APP_URL || "http://localhost:3000";
    const { origin } = new URL(appUrl);
    return {
      host_permissions: [`${origin}/*`],
      name: "OpenStarter Account",
      permissions: ["cookies"],
    };
  },
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
});
