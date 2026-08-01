import {
  account,
  deviceCode,
  invitation,
  member,
  organization,
  passkey,
  session,
  team,
  teamMember,
  twoFactor,
  user,
  verification,
} from "@openstarter/db/schema";

export const authSchema = {
  account,
  deviceCode,
  invitation,
  member,
  organization,
  passkey,
  session,
  team,
  teamMember,
  twoFactor,
  user,
  verification,
};

export const organizationTeams = { enabled: true } as const;
