import viteReact from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [viteReact()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    name: "web",
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 30_000,
  },
});
