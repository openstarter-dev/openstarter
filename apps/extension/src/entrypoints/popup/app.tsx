// apps/extension/src/entrypoints/popup/app.tsx —— popup 根组件：使用 TanStack Query
// hooks 和 AuthState 实现 5 状态机。依赖通过 hooks 注入，main.tsx 负责装配。
// 见 spec §6（状态机）/§7（错误处理）。
import {
  useCreditsQuery,
  usePlanQuery,
  useSubscriptionQuery,
  useUserQuery,
} from "../../lib/hooks";
import { useIsSignedOut } from "../../lib/auth-state";

import { AccountPanel } from "../../components/account-panel";
import { ErrorState } from "../../components/error-state";
import { SignedOut } from "../../components/signed-out";
import type { EnvResult } from "../../lib/env";
import type { AccountSnapshot } from "../../lib/state";

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

  // Extract user from query - it's optional and doesn't block the panel
  const user =
    userQuery.data != null
      ? { name: userQuery.data.name, email: userQuery.data.email }
      : null;

  // 1. env.ok === false → misconfigured
  if (!props.deps.env.ok) {
    return (
      <div className="p-6 text-destructive text-sm">
        Extension is misconfigured: {props.deps.env.reason}
      </div>
    );
  }

  // 2. isSignedOut → signed-out
  if (isSignedOut) {
    return <SignedOut onSignIn={props.deps.onSignIn} />;
  }

  // 3. Any query is pending → loading
  if (creditsQuery.isPending || planQuery.isPending || subscriptionQuery.isPending) {
    return <p className="p-6 text-muted-foreground text-sm">Loading...</p>;
  }

  // 4. Any query has error → ErrorState with retry
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

  // 5. All data ready → AccountPanel
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