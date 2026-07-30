import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./index";

describe("locale registry", () => {
  it("supports English and Chinese with English fallback", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "zh"]);
    expect(DEFAULT_LOCALE).toBe("en");
  });
});
