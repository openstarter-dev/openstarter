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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstarter/ui-web/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { user } from "@/modules/user/lib/api";
import { m } from "@/paraglide/messages.js";

export function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const keysQuery = useQuery({ ...user.queries.apiKeys() });

  const createMutation = useMutation({
    ...user.mutations.createApiKey(),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: (data) => {
      setRevealedKey(data.key);
      setTitle("");
      setCreateOpen(false);
      queryClient.invalidateQueries({
        queryKey: user.queries.apiKeys().queryKey,
      });
      toast.success(m["settings.apikeys.created"]());
    },
  });

  const revokeMutation = useMutation({
    ...user.mutations.revokeApiKey(),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: user.queries.apiKeys().queryKey,
      });
      toast.success(m["settings.apikeys.revoke_success"]());
    },
  });

  const items = keysQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{m["settings.apikeys.title"]()}</CardTitle>
          <CardDescription>{m["settings.apikeys.description"]()}</CardDescription>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" type="button">
          {m["settings.apikeys.create_key"]()}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {keysQuery.isPending ? (
          <p className="text-muted-foreground text-sm">{m["settings.apikeys.loading"]()}</p>
        ) : null}
        {keysQuery.error ? (
          <p className="text-destructive text-sm">{(keysQuery.error as Error).message}</p>
        ) : null}

        {items.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m["settings.apikeys.title_col"]()}</TableHead>
                  <TableHead>{m["settings.apikeys.prefix_col"]()}</TableHead>
                  <TableHead>{m["settings.apikeys.created_col"]()}</TableHead>
                  <TableHead className="text-right">
                    {m["settings.apikeys.actions_col"]()}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {item.keyPrefix}...
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        disabled={revokeMutation.isPending && revokeMutation.variables === item.id}
                        onClick={() => revokeMutation.mutate(item.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {m["settings.apikeys.revoke"]()}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {items.length === 0 && !keysQuery.isPending ? (
          <p className="text-muted-foreground text-sm">{m["settings.apikeys.no_keys"]()}</p>
        ) : null}
      </CardContent>

      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m["settings.apikeys.create_title_dialog"]()}</DialogTitle>
            <DialogDescription>{m["settings.apikeys.create_description"]()}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="apikey-title">{m["settings.apikeys.key_title"]()}</Label>
            <Input
              id="apikey-title"
              onChange={(e) => setTitle(e.target.value)}
              placeholder={m["settings.apikeys.key_placeholder"]()}
              value={title}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={title.trim().length === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate(title.trim())}
              type="button"
            >
              {createMutation.isPending
                ? m["settings.apikeys.creating"]()
                : m["settings.apikeys.create"]()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setRevealedKey(null);
          }
        }}
        open={revealedKey !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m["settings.apikeys.new_key_title"]()}</DialogTitle>
            <DialogDescription>{m["settings.apikeys.new_key_description"]()}</DialogDescription>
          </DialogHeader>
          <div className="break-all rounded-md bg-muted p-3 font-mono text-sm">{revealedKey}</div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (revealedKey) {
                  navigator.clipboard
                    .writeText(revealedKey)
                    .then(() => toast.success(m["settings.apikeys.copied"]()))
                    .catch(() => toast.error(m["settings.apikeys.copy_failed"]()));
                }
              }}
              type="button"
              variant="outline"
            >
              {m["settings.apikeys.copy"]()}
            </Button>
            <Button onClick={() => setRevealedKey(null)} type="button">
              {m["settings.apikeys.done"]()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
