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
      toast.success("API key created");
    },
  });

  const revokeMutation = useMutation({
    ...user.mutations.revokeApiKey(),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: user.queries.apiKeys().queryKey,
      });
      toast.success("API key revoked");
    },
  });

  const items = keysQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            Create keys to call protected endpoints without a session. The
            plaintext key is shown only once.
          </CardDescription>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" type="button">
          Create key
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {keysQuery.isPending ? (
          <p className="text-muted-foreground text-sm">Loading API keys...</p>
        ) : null}
        {keysQuery.error ? (
          <p className="text-destructive text-sm">
            {(keysQuery.error as Error).message}
          </p>
        ) : null}

        {items.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                        disabled={
                          revokeMutation.isPending &&
                          revokeMutation.variables === item.id
                        }
                        onClick={() => revokeMutation.mutate(item.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {items.length === 0 && !keysQuery.isPending ? (
          <p className="text-muted-foreground text-sm">No API keys yet.</p>
        ) : null}
      </CardContent>

      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Give your key a descriptive title so you can identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="apikey-title">Title</Label>
            <Input
              id="apikey-title"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Production server"
              value={title}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={title.trim().length === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate(title.trim())}
              type="button"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
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
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>
              Copy this key now. For security, it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="break-all rounded-md bg-muted p-3 font-mono text-sm">
            {revealedKey}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (revealedKey) {
                  navigator.clipboard
                    .writeText(revealedKey)
                    .then(() => toast.success("Copied to clipboard"))
                    .catch(() => toast.error("Failed to copy"));
                }
              }}
              type="button"
              variant="outline"
            >
              Copy
            </Button>
            <Button onClick={() => setRevealedKey(null)} type="button">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
