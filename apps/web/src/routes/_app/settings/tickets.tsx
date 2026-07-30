// apps/web/src/routes/_app/settings/tickets.tsx
// 工单客服自助面板（R21 / R27.2）：我的工单列表、创建工单、查看消息线程并回复。
// 数据面经类型化 RPC（`client.api.tickets`）→ packages/api（requireAuth，访问隔离仅本人工单）。

import { Badge } from "@openstarter/ui/components/badge";
import { Button } from "@openstarter/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openstarter/ui/components/dialog";
import { Input } from "@openstarter/ui/components/input";
import { Label } from "@openstarter/ui/components/label";
import { Textarea } from "@openstarter/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { client } from "@/lib/api";

export const Route = createFileRoute("/_app/settings/tickets")({
  component: TicketsPage,
});

const LIST_KEY = ["user", "tickets"] as const;

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "open") {
    return "default";
  }
  if (status === "replied") {
    return "secondary";
  }
  return "outline";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleString();
}

function TicketsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const listQuery = useQuery({
    queryKey: LIST_KEY,
    queryFn: async () => {
      const res = await client.api.tickets.$get({ query: {} });
      if (!res.ok) {
        throw new Error("Failed to load tickets");
      }
      const json = await res.json();
      return json.data;
    },
  });

  const detailQuery = useQuery({
    enabled: selectedId !== null,
    queryKey: ["user", "tickets", selectedId],
    queryFn: async () => {
      const res = await client.api.tickets[":id"].$get({
        param: { id: selectedId ?? "" },
      });
      if (!res.ok) {
        throw new Error("Failed to load ticket");
      }
      const json = await res.json();
      return json.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: { title: string; content: string }) => {
      const res = await client.api.tickets.$post({ json: input });
      if (!res.ok) {
        throw new Error("Failed to create ticket");
      }
      const json = await res.json();
      return json.data;
    },
    onSuccess: () => {
      setTitle("");
      setContent("");
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      toast.success("Ticket created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const replyMutation = useMutation({
    mutationFn: async (input: { id: string; content: string }) => {
      const res = await client.api.tickets[":id"].messages.$post({
        param: { id: input.id },
        json: { content: input.content },
      });
      if (!res.ok) {
        throw new Error("Failed to send reply");
      }
      const json = await res.json();
      return json.data;
    },
    onSuccess: (_data, variables) => {
      setReply("");
      queryClient.invalidateQueries({
        queryKey: ["user", "tickets", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      toast.success("Reply sent");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = listQuery.data?.items ?? [];
  const detail = detailQuery.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Support tickets</CardTitle>
            <CardDescription>
              Create a ticket and chat with our support team.
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" type="button">
            New ticket
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {listQuery.isPending ? (
            <p className="text-muted-foreground text-sm">Loading tickets...</p>
          ) : null}
          {listQuery.error ? (
            <p className="text-destructive text-sm">
              {(listQuery.error as Error).message}
            </p>
          ) : null}

          {items.length > 0 ? (
            <div className="divide-y rounded-lg border">
              {items.map((item) => (
                <button
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/60"
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  type="button"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">{item.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <Badge variant={statusVariant(item.status)}>
                    {item.status}
                  </Badge>
                </button>
              ))}
            </div>
          ) : null}

          {items.length === 0 && !listQuery.isPending ? (
            <p className="text-muted-foreground text-sm">No tickets yet.</p>
          ) : null}
        </CardContent>
      </Card>

      {detail ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{detail.ticket.title}</CardTitle>
              <CardDescription>
                <Badge variant={statusVariant(detail.ticket.status)}>
                  {detail.ticket.status}
                </Badge>
              </CardDescription>
            </div>
            <Button
              onClick={() => setSelectedId(null)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Close
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {detail.messages.map((message) => (
                <div
                  className={
                    message.role === "admin"
                      ? "rounded-lg bg-muted p-3"
                      : "rounded-lg border p-3"
                  }
                  key={message.id}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-xs uppercase">
                      {message.role}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(message.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">
                    {message.content}
                  </p>
                </div>
              ))}
            </div>

            {detail.ticket.status !== "closed" ? (
              <div className="space-y-2">
                <Label htmlFor="ticket-reply">Reply</Label>
                <Textarea
                  id="ticket-reply"
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your message..."
                  value={reply}
                />
                <Button
                  disabled={
                    reply.trim().length === 0 || replyMutation.isPending
                  }
                  onClick={() =>
                    replyMutation.mutate({
                      id: detail.ticket.id,
                      content: reply.trim(),
                    })
                  }
                  size="sm"
                  type="button"
                >
                  {replyMutation.isPending ? "Sending..." : "Send reply"}
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                This ticket is closed.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New support ticket</DialogTitle>
            <DialogDescription>
              Describe your issue and we&apos;ll get back to you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-title">Title</Label>
              <Input
                id="ticket-title"
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary"
                value={title}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-content">Description</Label>
              <Textarea
                id="ticket-content"
                onChange={(e) => setContent(e.target.value)}
                placeholder="Explain your issue in detail..."
                value={content}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={
                title.trim().length === 0 ||
                content.trim().length === 0 ||
                createMutation.isPending
              }
              onClick={() =>
                createMutation.mutate({
                  title: title.trim(),
                  content: content.trim(),
                })
              }
              type="button"
            >
              {createMutation.isPending ? "Creating..." : "Create ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
