import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { zValidator } from "./validator";

const bodySchema = z.object({
  name: z.string().min(1),
});

const app = new Hono().post("/echo", zValidator("json", bodySchema), (c) =>
  c.json({ ok: true, name: c.req.valid("json").name }),
);

describe("zValidator", () => {
  it("returns the API envelope for invalid input", async () => {
    const response = await app.request("/echo", {
      body: JSON.stringify({ name: "" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      code: number;
      data?: { fields?: unknown };
      message: string;
    };
    expect(payload.code).toBe(-1);
    expect(payload.message).toBe("invalid request");
    expect(payload.data?.fields).toBeDefined();
  });

  it("passes valid input through unchanged", async () => {
    const response = await app.request("/echo", {
      body: JSON.stringify({ name: "Ada" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ name: "Ada", ok: true });
  });
});
