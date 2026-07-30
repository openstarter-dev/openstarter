import { passkey } from "@better-auth/passkey";
import { admin, anonymous, organization, twoFactor } from "better-auth/plugins";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { authSchema, organizationTeams } from "./auth-database-schema";

const EXPECTED_AUTH_MODELS = [
  "account",
  "invitation",
  "member",
  "organization",
  "passkey",
  "session",
  "team",
  "teamMember",
  "twoFactor",
  "user",
  "verification",
] as const;

describe("Better Auth database schema projection", () => {
  it("contains every enabled plugin model without loading auth environment", () => {
    expect(Object.keys(authSchema).sort()).toEqual(EXPECTED_AUTH_MODELS);
    expect(organizationTeams).toEqual({ enabled: true });
  });
});

  it("matches the local Better Auth plugin runtime model fields", () => {
    const passkeySchema = passkey().schema;
    const twoFactorSchema = twoFactor().schema;
    const anonymousSchema = anonymous().schema;
    const adminSchema = admin().schema;
    const organizationSchema = organization({
      teams: organizationTeams,
    }).schema;
    const withGeneratedId = (fields: Record<string, object>) =>
      ["id", ...Object.keys(fields)].sort();

    expect(Object.keys(getTableColumns(authSchema.passkey)).sort()).toEqual(
      withGeneratedId(passkeySchema.passkey.fields)
    );
    expect(Object.keys(getTableColumns(authSchema.twoFactor)).sort()).toEqual(
      withGeneratedId(twoFactorSchema.twoFactor.fields)
    );

    const organizationModels = [
      [authSchema.organization, organizationSchema.organization.fields],
      [authSchema.member, organizationSchema.member.fields],
      [authSchema.invitation, organizationSchema.invitation.fields],
      [authSchema.team, organizationSchema.team.fields],
      [authSchema.teamMember, organizationSchema.teamMember.fields],
    ] as const;
    for (const [table, fields] of organizationModels) {
      expect(Object.keys(getTableColumns(table)).sort()).toEqual(
        withGeneratedId(fields)
      );
    }

    expect(Object.keys(getTableColumns(authSchema.user))).toEqual(
      expect.arrayContaining([
        ...Object.keys(twoFactorSchema.user.fields),
        ...Object.keys(anonymousSchema.user.fields),
        ...Object.keys(adminSchema.user.fields),
      ])
    );
    expect(Object.keys(getTableColumns(authSchema.session))).toEqual(
      expect.arrayContaining([
        ...Object.keys(adminSchema.session.fields),
        ...Object.keys(organizationSchema.session.fields),
      ])
    );
  });
