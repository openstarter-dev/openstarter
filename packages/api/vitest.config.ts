import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    name: "api",
    // Property tests over a per-suite SQLite DB routinely exceed vitest's
    // default 5s per-test ceiling under concurrent workspace load; 15s keeps the
    // suite green on loaded machines without masking genuine hangs.
    testTimeout: 15_000,
  },
});
