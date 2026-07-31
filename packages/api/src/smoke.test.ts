import { describe, expect, it } from "vitest";

import { healthRoute } from "./routes/health";

describe("health route", () => {
  it("returns an ok response", async () => {
    const response = await healthRoute.request("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
