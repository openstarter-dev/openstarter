import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    name: "auth",
    // Property tests with fc.asyncProperty over a fresh in-memory DB routinely
    // exceed vitest's default 5s per-test ceiling under concurrent workspace
    // load. 15s keeps the suite green on loaded machines without masking
    // genuine hangs.
    testTimeout: 15_000,
  },
});
