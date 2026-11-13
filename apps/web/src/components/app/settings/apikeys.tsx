import { m } from "@openstarter/i18n-web/messages";
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

import { authClient } from "@/lib/auth-client";

const apiKeysQueryKey = ["user", "apikeys"] as const;

export function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const keysQuery = useQuery({
    queryKey: apiKeysQueryKey,
    queryFn: async () => {
      const { data, error } = await authClient.apiKey.list({ query: {} });
      if (error) {
        throw new Error(error.message || "Failed to load API keys");
      }
      return data?.apiKeys ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (keyName: string) => {
      const { data, error } = await authClient.apiKey.create({ name: keyName });
      if (error) {
        throw new Error(error.message || "Failed to create API key");
      }
      return data;
    },
    onSuccess: async (data) => {
      setRevealedKey(data?.key ?? null);
      setName("");
      setCreateOpen(false);
      toast.success(m["settings.apikeys.created"]());
      await queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await authClient.apiKey.delete({ keyId });
      if (error) {
        throw new Error(error.message || "Failed to revoke API key");
      }
      return keyId;
    },
    onSuccess: async () => {
      toast.success(m["settings.apikeys.revoke_success"]());
      await queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });

  const items = keysQuery.data ?? [];

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
                    <TableCell className="font-medium">{item.name ?? "-"}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {item.start ?? "-"}...
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
              onChange={(e) => setName(e.target.value)}
              placeholder={m["settings.apikeys.key_placeholder"]()}
              value={name}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={name.trim().length === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate(name.trim())}
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
