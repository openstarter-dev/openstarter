import { describe, expect, it, vi } from "vitest";

import { buildAuthHeader } from "./api";

describe("buildAuthHeader", () => {
  it("returns a Bearer header when a token is present", () => {
    const cookieReader = vi.fn(() => Promise.resolve({ value: "abc.def" }));

    const headers = buildAuthHeader("http://localhost:3000", cookieReader);

    expect(headers).resolves.toEqual({ Authorization: "Bearer abc.def" });
  });

  it("returns an empty headers object when no token is present", () => {
    const cookieReader = vi.fn(() => Promise.resolve(null));

    const headers = buildAuthHeader("http://localhost:3000", cookieReader);

    expect(headers).resolves.toEqual({});
  });
});
