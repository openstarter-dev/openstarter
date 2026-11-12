import viteReact from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [viteReact()],
  resolve: {
    alias: {
      "#i18n": resolve(__dirname, "src/test/i18n-stub.ts"),
      "~": resolve(__dirname, "src"),
    },
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    name: "extension",
    setupFiles: ["./src/test/setup.ts"],
  },
});
