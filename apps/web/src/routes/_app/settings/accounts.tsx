// apps/web/src/routes/_app/settings/accounts.tsx
// 关联账户：列出已绑定 + 绑定/解绑 Google/GitHub/Apple。
// 实现「禁止解绑最后一个登录方式」守卫。

import { Button } from "@openstarter/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_app/settings/accounts")({
  component: AccountsPage,
});

/** 已知社交 provider 的显示名与图标区域（图标暂用 emoji 占位，后续接入 lucide 图标）。 */
const PROVIDER_META: Record<string, { label: string }> = {
  google: { label: "Google" },
  github: { label: "GitHub" },
  apple: { label: "Apple" },
  credential: { label: "Email & Password" },
  passkey: { label: "Passkey" },
};

function AccountsPage() {
  const { data: session } = authClient.useSession();
  const { data: accountsData, refetch: refetchAccounts } =
    authClient.useListAccounts();
  const accounts = accountsData ?? [];

  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  const totalCredentials =
    accounts.filter(
      (a) => a.provider === "credential" || a.provider !== "passkey",
    ).length;

  const handleLink = (provider: "google" | "github" | "apple") => {
    setLinking(provider);
    authClient.linkSocial({
      provider,
      callbackURL: "/settings/accounts",
    });
    // 重定向后不再 setLinking(null)，组件卸载
  };

  const handleUnlink = async (accountId: string, provider: string) => {
    if (accounts.length <= 1) {
      toast.error(
        "Cannot unlink your last sign-in method. Add another one first.",
      );
      return;
    }

    setUnlinking(accountId);
    try {
      const result = await authClient.unlinkAccount({
        providerId: provider,
        accountId,
      });
      if (result.error) {
        toast.error(result.error.message || "Failed to unlink account");
        return;
      }
      toast.success("Account unlinked");
      refetchAccounts();
    } finally {
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
        {/* 已有账号列表 */}
        {accounts.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Linked accounts</p>
            <div className="divide-y rounded-lg border">
              {accounts.map((account) => {
                const meta = PROVIDER_META[account.provider] ?? {
                  label: account.provider,
                };
                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="text-sm">{meta.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {account.email ?? ""}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={unlinking === account.id || accounts.length <= 1}
                      onClick={() => handleUnlink(account.id, account.provider)}
                      title={
                        accounts.length <= 1
                          ? "Cannot unlink your last sign-in method"
                          : undefined
                      }
                    >
                      {unlinking === account.id ? "Unlinking..." : "Unlink"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 绑定入口 */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Link a new account</p>
          <div className="flex flex-wrap gap-2">
            {["google", "github", "apple"].map((provider) => {
              const alreadyLinked = accounts.some(
                (a) => a.provider === provider,
              );
              return (
                <Button
                  key={provider}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={alreadyLinked || linking === provider}
                  onClick={() =>
                    handleLink(provider as "google" | "github" | "apple")
                  }
                >
                  {linking === provider
                    ? "Redirecting..."
                    : alreadyLinked
                      ? `${PROVIDER_META[provider]?.label ?? provider} linked`
                      : `Link ${PROVIDER_META[provider]?.label ?? provider}`}
                </Button>
              );
            })}
          </div>
        </div>

        {/* 匿名用户引导 */}
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
