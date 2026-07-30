import { describe, expect, it } from "vitest";

import { getAuthAdapterProvider } from "./adapter";

describe("auth adapter provider", () => {
  it("maps every supported database family", () => {
    expect(getAuthAdapterProvider("postgres")).toBe("pg");
    expect(getAuthAdapterProvider("mysql")).toBe("mysql");
    expect(getAuthAdapterProvider("sqlite")).toBe("sqlite");
    expect(getAuthAdapterProvider("turso")).toBe("sqlite");
    expect(getAuthAdapterProvider("d1")).toBe("sqlite");
  });
});
