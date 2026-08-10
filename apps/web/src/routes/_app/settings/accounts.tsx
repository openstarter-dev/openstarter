// apps/web/src/routes/_app/settings/accounts.tsx
// 关联账户：列出已绑定 + 绑定/解绑 Google/GitHub/Apple。
// 实现「禁止解绑最后一个登录方式」守卫。

import { Button } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { auth } from "@/modules/auth/lib/api";

export const Route = createFileRoute("/_app/settings/accounts")({
  component: AccountsPage,
});

const LINKABLE_PROVIDERS = ["google", "github", "apple"] as const;

const PROVIDER_META: Record<string, { label: string }> = {
  apple: { label: "Apple" },
  credential: { label: "Email & Password" },
  github: { label: "GitHub" },
  google: { label: "Google" },
  passkey: { label: "Passkey" },
};

const getLinkLabel = (
  provider: (typeof LINKABLE_PROVIDERS)[number],
  alreadyLinked: boolean,
  isLinking: boolean
) => {
  if (isLinking) {
    return "Redirecting...";
  }
  const label = PROVIDER_META[provider]?.label ?? provider;
  return alreadyLinked ? `${label} linked` : `Link ${label}`;
};

function AccountsPage() {
  const { data: session } = authClient.useSession();
  const accountsQuery = useQuery({ ...auth.queries.accounts() });
  const accounts = accountsQuery.data ?? [];

  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const unlinkInFlight = useRef(false);

  const handleLink = async (provider: (typeof LINKABLE_PROVIDERS)[number]) => {
    setLinking(provider);
    try {
      const result = await authClient.linkSocial({
        callbackURL: "/settings/accounts",
        provider,
      });
      if (result.error) {
        toast.error(result.error.message || "Failed to link account");
      }
    } finally {
      setLinking(null);
    }
  };

  const handleUnlink = async (accountId: string, providerId: string) => {
    if (unlinkInFlight.current) {
      return;
    }
    if (accounts.length <= 1) {
      toast.error(
        "Cannot unlink your last sign-in method. Add another one first."
      );
      return;
    }

    unlinkInFlight.current = true;
    setUnlinking(accountId);
    try {
      const result = await authClient.unlinkAccount({
        accountId,
        providerId,
      });
      if (result.error) {
        toast.error(result.error.message || "Failed to unlink account");
        return;
      }
      toast.success("Account unlinked");
      await accountsQuery.refetch();
    } finally {
      unlinkInFlight.current = false;
      setUnlinking(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
        <CardDescription>
          Manage linked social accounts and sign-in methods.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accountsQuery.isPending ? (
          <p className="text-muted-foreground text-sm">Loading accounts...</p>
        ) : null}
        {accountsQuery.error ? (
          <p className="text-destructive text-sm">
            {accountsQuery.error.message}
          </p>
        ) : null}
        {accounts.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium text-sm">Linked accounts</p>
            <div className="divide-y rounded-lg border">
              {accounts.map((account) => {
                const meta = PROVIDER_META[account.providerId] ?? {
                  label: account.providerId,
                };
                return (
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    key={account.id}
                  >
                    <span className="text-sm">{meta.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {account.accountId}
                    </span>
                    <Button
                      disabled={unlinking !== null || accounts.length <= 1}
                      onClick={() => {
                        handleUnlink(
                          account.accountId,
                          account.providerId
                        ).catch((error: Error) => {
                          toast.error(error.message);
                        });
                      }}
                      size="sm"
                      title={
                        accounts.length <= 1
                          ? "Cannot unlink your last sign-in method"
                          : undefined
                      }
                      type="button"
                      variant="ghost"
                    >
                      {unlinking === account.accountId
                        ? "Unlinking..."
                        : "Unlink"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="font-medium text-sm">Link a new account</p>
          <div className="flex flex-wrap gap-2">
            {LINKABLE_PROVIDERS.map((provider) => {
              const alreadyLinked = accounts.some(
                (account) => account.providerId === provider
              );
              return (
                <Button
                  disabled={alreadyLinked || linking === provider}
                  key={provider}
                  onClick={() => {
                    handleLink(provider).catch((error: Error) => {
                      toast.error(error.message);
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {getLinkLabel(provider, alreadyLinked, linking === provider)}
                </Button>
              );
            })}
          </div>
        </div>

        {session?.user?.email === null && (
          <div className="rounded-md bg-muted p-4 text-sm">
            You're currently signed in anonymously. Link an account above to
            save your data permanently.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
