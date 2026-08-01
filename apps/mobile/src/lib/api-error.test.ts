import { describe, expect, it, vi } from "vitest";

import { extractMessage, mapApiError, runRequest } from "./api-error";

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

describe("extractMessage", () => {
  it("reads the message field from the API envelope", () => {
    expect(extractMessage({ code: -1, message: "Boom" })).toBe("Boom");
  });

  it("returns null for an empty message", () => {
    expect(extractMessage({ code: -1, message: "" })).toBeNull();
  });

  it("returns null for a non-object body", () => {
    expect(extractMessage("plain text")).toBeNull();
    expect(extractMessage(null)).toBeNull();
  });

  it("returns null when message is not a string", () => {
    expect(extractMessage({ message: 42 })).toBeNull();
  });
});

describe("mapApiError", () => {
  it("classifies 401 as unauthorized, not as an error", () => {
    expect(mapApiError(401, { code: -1, message: "Unauthorized" })).toEqual({
      status: "unauthorized",
    });
  });

  it("uses the server message for a 500", () => {
    expect(
      mapApiError(500, { code: -1, message: "Internal Server Error" })
    ).toEqual({
      message: "Internal Server Error",
      status: "server-error",
    });
  });

  it("falls back to a status-code message when the body has none", () => {
    expect(mapApiError(500, null)).toEqual({
      message: "Request failed (500)",
      status: "server-error",
    });
  });

  it("classifies 403 as a server error carrying its message", () => {
    expect(mapApiError(403, { code: -1, message: "Forbidden" })).toEqual({
      message: "Forbidden",
      status: "server-error",
    });
  });
});

describe("runRequest", () => {
  it("extracts data from a successful envelope", async () => {
    const send = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, { code: 0, data: { plan: "member" }, message: "ok" })
      )
    );

    const result = await runRequest(
      send,
      (body) => (body as { data: { plan: string } }).data.plan
    );

    expect(result).toEqual({ data: "member", status: "success" });
  });

  it("maps a 401 response to unauthorized", async () => {
    const send = vi.fn(() =>
      Promise.resolve(jsonResponse(401, { code: -1, message: "Unauthorized" }))
    );

    const result = await runRequest(send, () => "unused");

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("maps a non-JSON error body to a status-code message", async () => {
    const send = vi.fn(() =>
      Promise.resolve(new Response("<html>502</html>", { status: 502 }))
    );

    const result = await runRequest(send, () => "unused");

    expect(result).toEqual({
      message: "Request failed (502)",
      status: "server-error",
    });
  });

  it("maps a rejected fetch to unreachable", async () => {
    const send = vi.fn(() =>
      Promise.reject(new Error("Network request failed"))
    );

    const result = await runRequest(send, () => "unused");

    expect(result).toEqual({ status: "unreachable" });
  });

  it("maps a malformed success body to unreachable rather than throwing", async () => {
    const send = vi.fn(() =>
      Promise.resolve(new Response("not json", { status: 200 }))
    );

    const result = await runRequest(send, () => "unused");

    expect(result).toEqual({ status: "unreachable" });
  });
});
