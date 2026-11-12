import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { client, unwrapQuery, withAbort } from "@/lib/api";

export const referralKeys = {
  all: ["referral"] as const,
  commissions: (page: number) => ["referral", "commissions", page] as const,
  me: () => ["referral", "me"] as const,
  relations: (page: number) => ["referral", "relations", page] as const,
};

const getMe = client.api.referral.me.$get;
const getCommissions = client.api.referral.commissions.$get;
const getRelations = client.api.referral.relations.$get;

type MeData = NonNullable<InferResponseType<typeof getMe, 200>["data"]>;
type CommissionsData = NonNullable<InferResponseType<typeof getCommissions, 200>["data"]>;
type RelationsData = NonNullable<InferResponseType<typeof getRelations, 200>["data"]>;

export type ReferralMe = MeData;

export const referral = {
  queries: {
    commissions: (page: number) =>
      queryOptions({
        placeholderData: keepPreviousData,
        queryFn: async ({ signal }) => {
          const res = await getCommissions(
            { query: { page: String(page), pageSize: "20" } },
            withAbort(signal),
          );
          return unwrapQuery<CommissionsData>(res, "Failed to load commissions");
        },
        queryKey: referralKeys.commissions(page),
      }),
    me: () =>
      queryOptions({
        queryFn: async ({ signal }) => {
          const res = await getMe(undefined, withAbort(signal));
          return unwrapQuery<MeData>(res, "Failed to load referral info");
        },
        queryKey: referralKeys.me(),
      }),
    relations: (page: number) =>
      queryOptions({
        placeholderData: keepPreviousData,
        queryFn: async ({ signal }) => {
          const res = await getRelations(
            { query: { page: String(page), pageSize: "20" } },
            withAbort(signal),
          );
          return unwrapQuery<RelationsData>(res, "Failed to load relations");
        },
        queryKey: referralKeys.relations(page),
      }),
  },
};
