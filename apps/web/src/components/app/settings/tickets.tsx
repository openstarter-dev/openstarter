import { Badge } from "@openstarter/ui-web/components/badge";
import { Button } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openstarter/ui-web/components/dialog";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import { Textarea } from "@openstarter/ui-web/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { tickets } from "@/modules/tickets/lib/api";
import { m } from "@/paraglide/messages.js";

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

export function TicketsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const listQuery = useQuery({ ...tickets.queries.list() });

  const detailQuery = useQuery({
    ...tickets.queries.detail(selectedId),
    enabled: selectedId !== null,
  });

  const createMutation = useMutation({
    ...tickets.mutations.create(),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      setTitle("");
      setContent("");
      setCreateOpen(false);
      queryClient.invalidateQueries({
        queryKey: tickets.queries.list().queryKey,
      });
      toast.success(m["settings.tickets.create_success"]());
    },
  });

  const replyMutation = useMutation({
    ...tickets.mutations.reply(),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: (_data, variables) => {
      setReply("");
      queryClient.invalidateQueries({
        queryKey: tickets.queries.detail(variables.id).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: tickets.queries.list().queryKey,
      });
      toast.success(m["settings.tickets.close_success"]());
    },
  });

  const items = listQuery.data?.items ?? [];
  const detail = detailQuery.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{m["settings.tickets.title"]()}</CardTitle>
            <CardDescription>{m["settings.tickets.description"]()}</CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" type="button">
            {m["settings.tickets.create_button"]()}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {listQuery.isPending ? (
            <p className="text-muted-foreground text-sm">{m["settings.tickets.loading"]()}</p>
          ) : null}
          {listQuery.error ? (
            <p className="text-destructive text-sm">{(listQuery.error as Error).message}</p>
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
                    {item.status === "open"
                      ? m["settings.tickets.status_open"]()
                      : item.status === "replied"
                        ? m["settings.tickets.status_replied"]()
                        : m["settings.tickets.status_closed"]()}
                  </Badge>
                </button>
              ))}
            </div>
          ) : null}

          {items.length === 0 && !listQuery.isPending ? (
            <p className="text-muted-foreground text-sm">{m["settings.tickets.empty"]()}</p>
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
                  {detail.ticket.status === "open"
                    ? m["settings.tickets.status_open"]()
                    : detail.ticket.status === "replied"
                      ? m["settings.tickets.status_replied"]()
                      : m["settings.tickets.status_closed"]()}
                </Badge>
              </CardDescription>
            </div>
            <Button onClick={() => setSelectedId(null)} size="sm" type="button" variant="ghost">
              {m["settings.tickets.cancel"]()}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {detail.messages.map((message) => (
                <div
                  className={
                    message.role === "admin" ? "rounded-lg bg-muted p-3" : "rounded-lg border p-3"
                  }
                  key={message.id}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-xs uppercase">
                      {message.role === "admin"
                        ? m["settings.tickets.support_team"]()
                        : m["settings.tickets.you"]()}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(message.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                </div>
              ))}
            </div>

            {detail.ticket.status === "closed" ? (
              <p className="text-muted-foreground text-sm">
                {m["settings.tickets.closed_notice"]()}
              </p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="ticket-reply">{m["settings.tickets.reply_placeholder"]()}</Label>
                <Textarea
                  id="ticket-reply"
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={m["settings.tickets.reply_placeholder"]()}
                  value={reply}
                />
                <Button
                  disabled={reply.trim().length === 0 || replyMutation.isPending}
                  onClick={() =>
                    replyMutation.mutate({
                      content: reply.trim(),
                      id: detail.ticket.id,
                    })
                  }
                  size="sm"
                  type="button"
                >
                  {replyMutation.isPending
                    ? m["settings.tickets.replying"]()
                    : m["settings.tickets.reply_submit"]()}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m["settings.tickets.create_title"]()}</DialogTitle>
            <DialogDescription>{m["settings.tickets.create_description"]()}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-title">{m["settings.tickets.title_label"]()}</Label>
              <Input
                id="ticket-title"
                onChange={(e) => setTitle(e.target.value)}
                placeholder={m["settings.tickets.title_placeholder"]()}
                value={title}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-content">{m["settings.tickets.content_label"]()}</Label>
              <Textarea
                id="ticket-content"
                onChange={(e) => setContent(e.target.value)}
                placeholder={m["settings.tickets.content_placeholder"]()}
                value={content}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={
                title.trim().length === 0 || content.trim().length === 0 || createMutation.isPending
              }
              onClick={() =>
                createMutation.mutate({
                  content: content.trim(),
                  title: title.trim(),
                })
              }
              type="button"
            >
              {createMutation.isPending
                ? m["settings.tickets.creating"]()
                : m["settings.tickets.create_submit"]()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
