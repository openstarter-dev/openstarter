import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    name: "ui",
  },
});
