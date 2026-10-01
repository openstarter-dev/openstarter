import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    name: "api",
    // Property tests can be CPU-bound under workspace-wide Turbo concurrency.
    testTimeout: 30_000,
  },
});
