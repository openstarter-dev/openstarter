import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// apps/web/.env 是唯一 env 事实源：优先 OPENSTARTER_API_URL（CI/部署显式覆盖），
// 其次应用地址 VITE_APP_URL，最后 localhost 兜底。
const API_BASE_URL =
  process.env.OPENSTARTER_API_URL ||
  process.env.VITE_APP_URL ||
  "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: resolve(__dirname, "src/renderer"),
  base: "./",
  build: {
    outDir: resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: API_BASE_URL,
        changeOrigin: true,
      },
    },
  },
});
