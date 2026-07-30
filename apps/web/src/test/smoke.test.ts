import { describe, expect, it } from "vitest";
import { BRAND_NAME } from "@/lib/branding";

describe("web test environment", () => {
  it("resolves application aliases in jsdom", () => {
    const element = document.createElement("span");
    element.textContent = BRAND_NAME;

    expect(element.textContent).toBe("Acme");
  });
});
