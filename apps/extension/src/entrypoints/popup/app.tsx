// apps/extension/src/entrypoints/popup/app.tsx —— popup 根组件：拉三个端点、
// 经 deriveState 归一化、渲染对应视图。依赖以 props 注入（AppDeps），
// 使测试可以绕过 chrome.* 与真实网络。
// 见 spec §6（状态机）/§7（错误处理）。
import { useEffect, useState } from "react";

import { AccountPanel } from "../../components/account-panel";
import { ErrorState } from "../../components/error-state";
import { SignedOut } from "../../components/signed-out";
import type { EnvResult } from "../../lib/env";
import type {
  EndpointResult,
  PanelState,
  SubscriptionStatusView,
  UserPlan,
} from "../../lib/state";
import { deriveState } from "../../lib/state";

export interface AppDeps {
  env: EnvResult;
  // 顶部用户名/邮箱展示（spec §6）。独立于三个账户端点抓取，允许失败/pending
  // 而不阻塞面板其余部分——因此返回 `null`（失败或未取到）而不是 EndpointResult，
  // 它不参与 deriveState 的"任一失败即整体降级"规则（那条规则只管三个账户端点）。
  fetchCredits: () => Promise<EndpointResult<number>>;
  fetchPlan: () => Promise<EndpointResult<UserPlan>>;
  fetchSubscription: () => Promise<EndpointResult<SubscriptionStatusView>>;
  fetchUser: () => Promise<{ name: string; email: string } | null>;
  onManage: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

async function loadState(deps: AppDeps): Promise<PanelState> {
  if (!deps.env.ok) {
    return { kind: "misconfigured", reason: deps.env.reason };
  }

  const [plan, credits, subscription] = await Promise.all([
    deps.fetchPlan(),
    deps.fetchCredits(),
    deps.fetchSubscription(),
  ]);

  return deriveState({
    endpoints: { credits, plan, subscription },
    env: deps.env,
  });
}

export function App(props: { deps: AppDeps }) {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [user, setUser] = useState<{ name: string; email: string } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    loadState(props.deps).then((next) => {
      if (!cancelled) {
        setState(next);
      }
    });
    props.deps.fetchUser().then((next) => {
      if (!cancelled) {
        setUser(next);
      }
    });
    return () => {
      cancelled = true;
    };
    // props.deps 预期是调用方持有的稳定引用（见 main.tsx），对应该 popup 每次打开只
    // 抓取一次的设计；将其列为依赖以避免 lint 关于 props 引用的告警。
  }, [props.deps]);

  if (state.kind === "loading") {
    return <p className="p-6 text-muted-foreground text-sm">Loading...</p>;
  }

  if (state.kind === "misconfigured") {
    return (
      <div className="p-6 text-destructive text-sm">
        Extension is misconfigured: {state.reason}
      </div>
    );
  }

  if (state.kind === "signed-out") {
    return <SignedOut onSignIn={props.deps.onSignIn} />;
  }

  if (state.kind === "error") {
    return (
      <ErrorState
        message={state.message}
        onRetry={() => {
          loadState(props.deps).then(setState);
        }}
      />
    );
  }

  return (
    <AccountPanel
      data={state.data}
      onManage={props.deps.onManage}
      onSignOut={props.deps.onSignOut}
      user={user}
    />
  );
}
