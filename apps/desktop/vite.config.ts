import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const API_BASE_URL = process.env.OPENSTARTER_API_URL || "http://localhost:3000";

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
