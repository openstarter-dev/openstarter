import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { client, unwrapMutation, unwrapQuery, withAbort } from "@/lib/api";
import { userKeys } from "@/modules/user/lib/api";

const getTicket = client.api.tickets[":id"].$get;
const getTickets = client.api.tickets.$get;
const createTicket = client.api.tickets.$post;
const createTicketReply = client.api.tickets[":id"].messages.$post;

type TicketDetailData = NonNullable<InferResponseType<typeof getTicket, 200>["data"]>;
type TicketListData = NonNullable<InferResponseType<typeof getTickets, 200>["data"]>;
type TicketCreated = NonNullable<InferResponseType<typeof createTicket, 200>["data"]>;
type TicketReplyCreated = NonNullable<InferResponseType<typeof createTicketReply, 200>["data"]>;

const queries = {
  detail: (id: string | null) =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getTicket({ param: { id: id ?? "" } }, withAbort(signal));
        return unwrapQuery<TicketDetailData>(res, "Failed to load ticket");
      },
      queryKey: userKeys.tickets.detail(id),
    }),
  list: () =>
    queryOptions({
      queryFn: async ({ signal }) => {
        const res = await getTickets({ query: {} }, withAbort(signal));
        return unwrapQuery<TicketListData>(res, "Failed to load tickets");
      },
      queryKey: userKeys.tickets.all,
    }),
};

const mutations = {
  create: () =>
    mutationOptions({
      meta: { invalidates: [userKeys.tickets.all] },
      mutationFn: async (input: { title: string; content: string }) => {
        const res = await client.api.tickets.$post({ json: input });
        return unwrapMutation<TicketCreated>(res, "Failed to create ticket");
      },
    }),
  reply: () =>
    mutationOptions({
      meta: { invalidates: [userKeys.tickets.all] },
      mutationFn: async (input: { id: string; content: string }) => {
        const res = await client.api.tickets[":id"].messages.$post({
          json: { content: input.content },
          param: { id: input.id },
        });
        return unwrapMutation<TicketReplyCreated>(res, "Failed to send reply");
      },
    }),
};

export const tickets = { mutations, queries } as const;
