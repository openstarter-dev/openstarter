import { i18n } from "#i18n";

import { useCreditsQuery, usePlanQuery, useSubscriptionQuery, useUserQuery } from "../../lib/hooks";
import { useIsSignedOut } from "../../lib/auth-state";

import { AccountPanel } from "../../components/account-panel";
import { ErrorState } from "../../components/error-state";
import { SignedOut } from "../../components/signed-out";
import type { EnvResult } from "../../lib/env";
import type { AccountSnapshot } from "../../lib/types";

export interface AppDeps {
  env: EnvResult;
  onManage: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function App(props: { deps: AppDeps }) {
  const isSignedOut = useIsSignedOut();
  const userQuery = useUserQuery();
  const creditsQuery = useCreditsQuery();
  const planQuery = usePlanQuery();
  const subscriptionQuery = useSubscriptionQuery();

  const user =
    userQuery.data != null ? { name: userQuery.data.name, email: userQuery.data.email } : null;

  if (!props.deps.env.ok) {
    return (
      <div className="p-6 text-destructive text-sm">
        {i18n.t("app.misconfigured", { reason: props.deps.env.reason })}
      </div>
    );
  }

  if (isSignedOut) {
    return <SignedOut onSignIn={props.deps.onSignIn} />;
  }

  if (creditsQuery.isPending || planQuery.isPending || subscriptionQuery.isPending) {
    return <p className="p-6 text-muted-foreground text-sm">{i18n.t("app.loading")}</p>;
  }

  const errorQuery = creditsQuery.isError
    ? creditsQuery
    : planQuery.isError
      ? planQuery
      : subscriptionQuery.isError
        ? subscriptionQuery
        : null;

  if (errorQuery) {
    return (
      <ErrorState
        message={errorQuery.error?.message ?? "An error occurred"}
        onRetry={() => {
          creditsQuery.refetch();
          planQuery.refetch();
          subscriptionQuery.refetch();
        }}
      />
    );
  }

  const snapshot: AccountSnapshot = {
    creditsBalance: creditsQuery.data ?? 0,
    plan: (planQuery.data ?? "none") as AccountSnapshot["plan"],
    subscription: subscriptionQuery.data ?? {
      hasSubscription: false,
      nextBillingDate: null,
      planName: null,
      status: null,
    },
  };

  return (
    <AccountPanel
      data={snapshot}
      user={user}
      onManage={props.deps.onManage}
      onSignOut={props.deps.onSignOut}
    />
  );
}
