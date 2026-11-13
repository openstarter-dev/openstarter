import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const ac = createAccessControl(defaultStatements);

export const roles = {
  owner: ownerAc,
  admin: adminAc,
  member: memberAc,
} as const;

export * from "./access";
export * from "./service";
