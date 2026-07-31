import {
  invitation,
  member,
  organization,
  passkey,
  session,
  team,
  teamMember,
  twoFactor,
  user,
} from "@openstarter/db/schema";
import { createDb } from "@openstarter/db/server";
import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

const database = createDb({
  provider: "sqlite",
  singleton: false,
  url: ":memory:",
});

beforeAll(async () => {
  await database.run(sql`
    CREATE TABLE user (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      utm_source TEXT NOT NULL DEFAULT '',
      ip TEXT NOT NULL DEFAULT '',
      locale TEXT NOT NULL DEFAULT '',
      two_factor_enabled INTEGER DEFAULT 0,
      role TEXT,
      banned INTEGER DEFAULT 0,
      ban_reason TEXT,
      ban_expires INTEGER,
      is_anonymous INTEGER DEFAULT 0
    )
  `);
  await database.run(sql`
    CREATE TABLE organization (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      logo TEXT,
      created_at INTEGER NOT NULL,
      metadata TEXT
    )
  `);
  await database.run(sql`
    CREATE TABLE team (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER
    )
  `);
  await database.run(sql`
    CREATE TABLE session (
      id TEXT PRIMARY KEY NOT NULL,
      expires_at INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      impersonated_by TEXT,
      active_organization_id TEXT,
      active_team_id TEXT
    )
  `);
  await database.run(sql`
    CREATE TABLE passkey (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT,
      public_key TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL,
      counter INTEGER NOT NULL,
      device_type TEXT NOT NULL,
      backed_up INTEGER NOT NULL,
      transports TEXT,
      created_at INTEGER,
      aaguid TEXT
    )
  `);
  await database.run(sql`
    CREATE TABLE two_factor (
      id TEXT PRIMARY KEY NOT NULL,
      secret TEXT NOT NULL,
      backup_codes TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      verified INTEGER DEFAULT 1
    )
  `);
  await database.run(sql`
    CREATE TABLE member (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL
    )
  `);
  await database.run(sql`
    CREATE TABLE invitation (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT,
      team_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      inviter_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
    )
  `);
  await database.run(sql`
    CREATE TABLE team_member (
      id TEXT PRIMARY KEY NOT NULL,
      team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      created_at INTEGER
    )
  `);
});

describe("Better Auth plugin SQLite production schema", () => {
  it("inserts, selects, and joins every enabled plugin model", async () => {
    const now = new Date("2026-07-24T00:00:00.000Z");
    const later = new Date("2026-07-25T00:00:00.000Z");

    await database.insert(user).values({
      banExpires: later,
      banned: true,
      banReason: "security review",
      email: "owner@example.com",
      emailVerified: true,
      id: "user-1",
      isAnonymous: true,
      name: "Owner",
      role: "admin",
      twoFactorEnabled: true,
    });
    await database.insert(organization).values({
      createdAt: now,
      id: "organization-1",
      logo: "https://example.com/logo.svg",
      metadata: JSON.stringify({ plan: "pro" }),
      name: "openstarter",
      slug: "openstarter",
    });
    await database.insert(team).values({
      createdAt: now,
      id: "team-1",
      name: "Platform",
      organizationId: "organization-1",
      updatedAt: later,
    });
    await database.insert(session).values({
      activeOrganizationId: "organization-1",
      activeTeamId: "team-1",
      expiresAt: later,
      id: "session-1",
      impersonatedBy: "admin-1",
      token: "token-1",
      userId: "user-1",
    });
    await database.insert(passkey).values({
      aaguid: "aaguid-1",
      backedUp: true,
      counter: 7,
      createdAt: now,
      credentialID: "credential-1",
      deviceType: "multiDevice",
      id: "passkey-1",
      name: "Laptop",
      publicKey: "public-key-1",
      transports: "internal",
      userId: "user-1",
    });
    await database.insert(twoFactor).values({
      backupCodes: "encrypted-backup-codes",
      id: "two-factor-1",
      secret: "encrypted-secret",
      userId: "user-1",
    });
    await database.insert(member).values({
      createdAt: now,
      id: "member-1",
      organizationId: "organization-1",
      userId: "user-1",
    });
    await database.insert(invitation).values({
      createdAt: now,
      email: "invitee@example.com",
      expiresAt: later,
      id: "invitation-1",
      inviterId: "user-1",
      organizationId: "organization-1",
      role: "member",
      teamId: "team-1",
    });
    await database.insert(teamMember).values({
      createdAt: now,
      id: "team-member-1",
      teamId: "team-1",
      userId: "user-1",
    });

    const authRows = await database
      .select({
        activeOrganizationId: session.activeOrganizationId,
        activeTeamId: session.activeTeamId,
        backedUp: passkey.backedUp,
        banExpires: user.banExpires,
        banned: user.banned,
        banReason: user.banReason,
        credentialID: passkey.credentialID,
        impersonatedBy: session.impersonatedBy,
        isAnonymous: user.isAnonymous,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
        verified: twoFactor.verified,
      })
      .from(user)
      .innerJoin(session, eq(session.userId, user.id))
      .innerJoin(passkey, eq(passkey.userId, user.id))
      .innerJoin(twoFactor, eq(twoFactor.userId, user.id));

    expect(authRows).toEqual([
      {
        activeOrganizationId: "organization-1",
        activeTeamId: "team-1",
        backedUp: true,
        banExpires: later,
        banned: true,
        banReason: "security review",
        credentialID: "credential-1",
        impersonatedBy: "admin-1",
        isAnonymous: true,
        role: "admin",
        twoFactorEnabled: true,
        verified: true,
      },
    ]);

    const organizationRows = await database
      .select({
        invitationStatus: invitation.status,
        memberRole: member.role,
        organizationId: organization.id,
        teamId: team.id,
        teamMemberId: teamMember.id,
      })
      .from(organization)
      .innerJoin(member, eq(member.organizationId, organization.id))
      .innerJoin(team, eq(team.organizationId, organization.id))
      .innerJoin(
        teamMember,
        and(
          eq(teamMember.teamId, team.id),
          eq(teamMember.userId, member.userId)
        )
      )
      .innerJoin(
        invitation,
        and(
          eq(invitation.organizationId, organization.id),
          eq(invitation.teamId, team.id)
        )
      );

    expect(organizationRows).toEqual([
      {
        invitationStatus: "pending",
        memberRole: "member",
        organizationId: "organization-1",
        teamId: "team-1",
        teamMemberId: "team-member-1",
      },
    ]);
  });
});
