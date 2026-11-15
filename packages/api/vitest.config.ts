import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    name: "api",
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
