import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    environment: "node",
    include: ["*.test.ts"],
    name: "scripts",
    testTimeout: 30_000,
  },
});
