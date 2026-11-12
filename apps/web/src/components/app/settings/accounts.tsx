import { Button } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { auth } from "@/modules/auth/lib/api";
import { m } from "@openstarter/i18n-web/messages";

const LINKABLE_PROVIDERS = ["google", "github", "apple"] as const;

const PROVIDER_META: Record<string, { label: string }> = {
  apple: { label: m["settings.accounts.provider_apple"]() },
  credential: { label: m["settings.accounts.provider_email"]() },
  github: { label: m["settings.accounts.provider_github"]() },
  google: { label: m["settings.accounts.provider_google"]() },
  passkey: { label: m["settings.accounts.provider_passkey"]() },
};

const getLinkLabel = (
  provider: (typeof LINKABLE_PROVIDERS)[number],
  alreadyLinked: boolean,
  isLinking: boolean,
) => {
  if (isLinking) {
    return m["settings.accounts.redirecting"]();
  }
  const label = PROVIDER_META[provider]?.label ?? provider;
  return alreadyLinked
    ? m["settings.accounts.linked"]({ provider: label })
    : m["settings.accounts.link"]({ provider: label });
};

export function AccountsPage() {
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
        toast.error(result.error.message || m["settings.accounts.link_failed"]());
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
      toast.error(m["settings.accounts.cannot_unlink_last"]());
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
        toast.error(result.error.message || m["settings.accounts.unlink_failed"]());
        return;
      }
      toast.success(m["settings.accounts.unlink_success"]());
      await accountsQuery.refetch();
    } finally {
      unlinkInFlight.current = false;
      setUnlinking(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m["settings.accounts.title"]()}</CardTitle>
        <CardDescription>{m["settings.accounts.description"]()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accountsQuery.isPending ? (
          <p className="text-muted-foreground text-sm">{m["settings.accounts.loading"]()}</p>
        ) : null}
        {accountsQuery.error ? (
          <p className="text-destructive text-sm">{accountsQuery.error.message}</p>
        ) : null}
        {accounts.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium text-sm">{m["settings.accounts.linked_accounts"]()}</p>
            <div className="divide-y rounded-lg border">
              {accounts.map((account) => {
                const meta = PROVIDER_META[account.providerId] ?? {
                  label: account.providerId,
                };
                return (
                  <div className="flex items-center justify-between px-4 py-3" key={account.id}>
                    <span className="text-sm">{meta.label}</span>
                    <span className="text-muted-foreground text-xs">{account.accountId}</span>
                    <Button
                      disabled={unlinking !== null || accounts.length <= 1}
                      onClick={() => {
                        handleUnlink(account.accountId, account.providerId).catch(
                          (error: Error) => {
                            toast.error(error.message);
                          },
                        );
                      }}
                      size="sm"
                      title={
                        accounts.length <= 1
                          ? m["settings.accounts.cannot_unlink_current"]()
                          : undefined
                      }
                      type="button"
                      variant="ghost"
                    >
                      {unlinking === account.accountId
                        ? m["settings.accounts.unlinking"]()
                        : m["settings.accounts.unlink"]()}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="font-medium text-sm">{m["settings.accounts.link_new"]()}</p>
          <div className="flex flex-wrap gap-2">
            {LINKABLE_PROVIDERS.map((provider) => {
              const alreadyLinked = accounts.some((account) => account.providerId === provider);
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
            {m["settings.accounts.anonymous_notice"]()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
