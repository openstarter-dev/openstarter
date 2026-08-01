import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "**/routeTree.gen.ts",
        "**/test/**",
      ],
      include: [
        "apps/*/src/**/*.{ts,tsx}",
        "packages/*/src/**/*.{ts,tsx}",
        "packages/*/*/src/**/*.{ts,tsx}",
      ],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      thresholds: {
        branches: 2,
        functions: 2,
        lines: 2,
        statements: 2,
      },
    },
    projects: [
      "apps/web/vitest.config.ts",
      "apps/desktop/vitest.config.ts",
      "packages/*/vitest.config.ts",
      "packages/*/*/vitest.config.ts",
      "scripts/vitest.config.ts",
    ],
  },
});
