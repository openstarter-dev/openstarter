import { describe, expect, it } from "vitest";

import { statusRoute } from "./status";

describe("status route", () => {
  it("returns ok with version and timestamp via the shared envelope", async () => {
    const before = Date.now();
    const response = await statusRoute.request("/api/status");
    const after = Date.now();

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual({
      code: 0,
      data: {
        status: "ok",
        timestamp: expect.any(String),
        version: "0.1.0",
      },
      message: "ok",
    });
    const ts = Date.parse(body.data.timestamp);
    expect(ts).toBeGreaterThanOrEqual(before - 1000);
    expect(ts).toBeLessThanOrEqual(after + 1000);
  });
});
