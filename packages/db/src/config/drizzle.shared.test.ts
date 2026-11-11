import { describe, expect, it } from "vitest";

import { resolveDialect } from "./drizzle.shared";

describe("resolveDialect", () => {
  it("maps postgres to the postgresql drizzle-kit dialect", () => {
    expect(resolveDialect("postgres")).toBe("postgresql");
  });

  it.each(["d1", "", undefined])("maps %s to the sqlite dialect", (provider) => {
    expect(resolveDialect(provider)).toBe("sqlite");
  });

  it("throws on an unsupported provider", () => {
    expect(() => resolveDialect("oracle")).toThrow("Unsupported DATABASE_PROVIDER: oracle");
  });
});
