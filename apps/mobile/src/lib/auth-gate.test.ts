import { describe, expect, it } from "vitest";

import { deriveAuthGate } from "./auth-gate";

describe("deriveAuthGate", () => {
  it("is loading while the session is pending, even with no session yet", () => {
    expect(deriveAuthGate({ isPending: true, session: null })).toBe("loading");
  });

  it("is loading while pending even if a session is already present", () => {
    expect(deriveAuthGate({ isPending: true, session: { user: { id: "u1" } } })).toBe("loading");
  });

  it("is authenticated when a resolved session carries a user", () => {
    expect(deriveAuthGate({ isPending: false, session: { user: { id: "u1" } } })).toBe(
      "authenticated",
    );
  });

  it("is unauthenticated when the resolved session is null", () => {
    expect(deriveAuthGate({ isPending: false, session: null })).toBe("unauthenticated");
  });

  it("is unauthenticated when the resolved session is undefined", () => {
    expect(deriveAuthGate({ isPending: false, session: undefined })).toBe("unauthenticated");
  });

  it("is unauthenticated when the session object has no user", () => {
    expect(deriveAuthGate({ isPending: false, session: {} })).toBe("unauthenticated");
  });
});
