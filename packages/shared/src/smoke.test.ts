import { describe, expect, it } from "vitest";

import { respOk } from "./index";

describe("shared test environment", () => {
  it("resolves package exports in node", () => {
    expect(respOk()).toEqual({ code: 0, message: "ok" });
  });
});
