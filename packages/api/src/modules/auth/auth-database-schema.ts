import {
  account,
  apikey,
  deviceCode,
  invitation,
  member,
  organization,
  passkey,
  rateLimit,
  session,
  team,
  teamMember,
  twoFactor,
  user,
  verification,
} from "../../db/schema";

export const authSchema = {
  account,
  apikey,
  deviceCode,
  invitation,
  member,
  organization,
  passkey,
  rateLimit,
  session,
  team,
  teamMember,
  twoFactor,
  user,
  verification,
};

export const organizationTeams = { enabled: true } as const;
