import { describe, expect, it } from "vitest";

import { resolveFileUrl } from "./drizzle.shared";

describe("resolveFileUrl", () => {
  it("resolves a relative file: URL against the given root", () => {
    expect(resolveFileUrl("file:local.db", "/repo")).toBe("file:///repo/local.db");
  });

  it("resolves nested relative file: URLs against the given root", () => {
    expect(resolveFileUrl("file:data/app.db", "/repo")).toBe("file:///repo/data/app.db");
  });

  it("passes through absolute-path file: URLs untouched", () => {
    expect(resolveFileUrl("file:/abs/path.db", "/repo")).toBe("file:/abs/path.db");
  });

  it("passes through file:// URLs untouched", () => {
    expect(resolveFileUrl("file:///abs/path.db", "/repo")).toBe("file:///abs/path.db");
  });

  it("passes through non-file connection URLs untouched", () => {
    expect(resolveFileUrl("libsql://user-host.turso.io", "/repo")).toBe(
      "libsql://user-host.turso.io",
    );
  });
});
