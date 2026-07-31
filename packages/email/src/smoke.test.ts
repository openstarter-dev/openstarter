import { describe, expect, it } from "vitest";

import { EmailTemplate } from "./index";

describe("email template registry", () => {
  it("contains every authentication email template", () => {
    expect(Object.values(EmailTemplate)).toEqual([
      "delete-account",
      "change-email",
      "confirm-email",
      "reset-password",
      "magic-link",
      "sign-in-otp",
      "organization-invitation",
    ]);
  });
});
