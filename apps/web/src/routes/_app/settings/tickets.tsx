import { createFileRoute } from "@tanstack/react-router";
import { TicketsPage } from "@/components/app/settings/tickets";
import { tickets } from "@/modules/tickets/lib/api";

export const Route = createFileRoute("/_app/settings/tickets")({
  loader: ({ context: { queryClient } }) => queryClient.prefetchQuery(tickets.queries.list()),
  component: TicketsPage,
});
