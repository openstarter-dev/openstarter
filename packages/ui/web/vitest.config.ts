import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    name: "ui-web",
    // Property tests over chart geometry can exceed Vitest's default timeout
    // on loaded workspace runs.
    testTimeout: 15_000,
  },
});
