import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("class name utility", () => {
  it("merges conditional and conflicting Tailwind classes", () => {
    expect(cn("px-2", false, "px-4")).toBe("px-4");
  });
});
