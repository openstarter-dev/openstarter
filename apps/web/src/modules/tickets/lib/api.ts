// Query 工厂：tickets 模块（R21）
// 数据面经类型化 RPC（`client.api.tickets`）→ packages/api（requireAuth）。

import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { client } from "@/lib/api";

const queries = {
  list: () =>
    queryOptions({
      queryKey: ["user", "tickets"] as const,
      queryFn: async () => {
        const res = await client.api.tickets.$get({ query: {} });
        if (!res.ok) throw new Error("Failed to load tickets");
        const json = await res.json();
        return json.data;
      },
    }),
  detail: (id: string | null) =>
    queryOptions({
      queryKey: ["user", "tickets", id] as const,
      queryFn: async () => {
        const res = await client.api.tickets[":id"].$get({
          param: { id: id ?? "" },
        });
        if (!res.ok) throw new Error("Failed to load ticket");
        const json = await res.json();
        return json.data;
      },
    }),
};

const mutations = {
  create: () =>
    mutationOptions({
      mutationFn: async (input: { title: string; content: string }) => {
        const res = await client.api.tickets.$post({ json: input });
        if (!res.ok) throw new Error("Failed to create ticket");
        const json = await res.json();
        return json.data;
      },
    }),
  reply: () =>
    mutationOptions({
      mutationFn: async (input: { id: string; content: string }) => {
        const res = await client.api.tickets[":id"].messages.$post({
          json: { content: input.content },
          param: { id: input.id },
        });
        if (!res.ok) throw new Error("Failed to send reply");
        const json = await res.json();
        return json.data;
      },
    }),
};

export const tickets = { queries, mutations } as const;
