import { describe, expect, it } from "vitest";

import { statusRouter } from "./modules/status/router";

describe("health route", () => {
  it("returns an ok response", async () => {
    const response = await statusRouter.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
