import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("react versions", () => {
  it("react and react-dom resolve to the exact same version", () => {
    const reactVersion = (require("react/package.json") as { version: string }).version;
    const reactDomVersion = (require("react-dom/package.json") as { version: string }).version;

    expect(reactDomVersion).toBe(reactVersion);
  });
});
