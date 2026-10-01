import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    name: "billing-web",
    // Property tests over a per-suite SQLite DB can exceed Vitest's default
    // 5s timeout when the workspace runs tests concurrently.
    testTimeout: 15_000,
  },
});
