// 设备授权（RFC 8628）验证页面 —— CLI 登录流程的人侧入口。
//
// 流程：CLI 运行 `openstarter login` → 后端发设备码/用户码 → 用户打开
// verification_uri_complete（即本页，附带 ?user_code=XXXX）→ 本页先 GET
// /api/auth/device?user_code= 把当前登录会话 claim 到该 deviceCode，再 POST
// /api/auth/device/approve 批准 → CLI 端轮询 token 端点拿到会话 token 登录完成。
//
// 注意：本页置于 _app 布局下（而非 _auth-pages），因为设备授权要求用户已登录
// —— _app/route.tsx 的 beforeLoad 会把未登录者重定向到 /login 并在上下文注入 session，
// 这正是 approve 端点所需（其 requireHeaders:true，靠会话 cookie 鉴权）。

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type Phase = "claiming" | "ready" | "approving" | "approved" | "denied" | "error";

interface DeviceState {
  message: string;
  phase: Phase;
  userCode?: string;
}

const STATUS_BY_PHASE: Record<Phase, string> = {
  claiming: "正在验证设备代码…",
  ready: "请确认是否授权该设备登录",
  approving: "正在授权…",
  approved: "授权成功！",
  denied: "已拒绝授权。",
  error: "授权失败。",
};

export const Route = createFileRoute("/_app/device")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { user_code?: string } => ({
    user_code:
      typeof search.user_code === "string" ? search.user_code : undefined,
  }),
  component: DeviceAuthPage,
});

function DeviceAuthPage() {
  const search = Route.useSearch();
  const initialUserCode = search.user_code?.trim() || undefined;

  const [state, setState] = useState<DeviceState>({
    message: STATUS_BY_PHASE.claiming,
    phase: "claiming",
  });

  useEffect(() => {
    let cancelled = false;
    const userCode = initialUserCode;
    if (!userCode) {
      setState({
        message: "缺少授权代码。请回到终端，点击显示的完整链接重新进入本页。",
        phase: "error",
      });
      return;
    }

    void (async () => {
      try {
        const claim = await fetch(
          `/api/auth/device?user_code=${encodeURIComponent(userCode)}`,
          { method: "GET" },
        );
        if (!claim.ok) {
          const err = await safeError(claim);
          if (!cancelled) {
            setState({ message: err || "无法识别该授权代码。", phase: "error", userCode });
          }
          return;
        }
        if (!cancelled) {
          setState({ message: STATUS_BY_PHASE.ready, phase: "ready", userCode });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            message: errorMessage(err, "网络错误，请稍后重试。"),
            phase: "error",
            userCode,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialUserCode]);

  const approve = async () => {
    if (!state.userCode) {
      return;
    }
    setState({
      message: STATUS_BY_PHASE.approving,
      phase: "approving",
      userCode: state.userCode,
    });
    try {
      const res = await fetch("/api/auth/device/approve", {
        body: JSON.stringify({ userCode: state.userCode }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        const err = await safeError(res);
        setState({ message: err || "授权失败。", phase: "error", userCode: state.userCode });
        return;
      }
      setState({ message: STATUS_BY_PHASE.approved, phase: "approved" });
    } catch (err) {
      setState({
        message: errorMessage(err, "网络错误，请稍后重试。"),
        phase: "error",
        userCode: state.userCode,
      });
    }
  };

  const deny = async () => {
    if (!state.userCode) {
      return;
    }
    try {
      const res = await fetch("/api/auth/device/deny", {
        body: JSON.stringify({ userCode: state.userCode }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        const err = await safeError(res);
        setState({ message: err || "拒绝失败。", phase: "error", userCode: state.userCode });
        return;
      }
      setState({ message: STATUS_BY_PHASE.denied, phase: "denied" });
    } catch (err) {
      setState({
        message: errorMessage(err, "网络错误，请稍后重试。"),
        phase: "error",
        userCode: state.userCode,
      });
    }
  };

  if (state.phase === "approved") {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">✓</div>
        <h1 className="font-bold text-2xl">授权成功！</h1>
        <p className="text-muted-foreground">您可以关闭此页面并返回终端继续操作。</p>
      </div>
    );
  }

  if (state.phase === "denied") {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">✕</div>
        <h1 className="font-bold text-2xl">已拒绝授权</h1>
        <p className="text-muted-foreground">您已拒绝该设备的登录请求。</p>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">✕</div>
        <h1 className="font-bold text-2xl">授权失败</h1>
        <p className="text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-center">
        <h1 className="font-bold text-2xl">设备授权</h1>
        <p className="text-muted-foreground">
          命令行终端正在请求登录您的账户，请在下方确认。
        </p>
      </div>

      {state.phase === "claiming" && (
        <p className="text-center text-muted-foreground">{state.message}</p>
      )}

      {state.phase === "ready" && (
        <>
          {state.userCode && (
            <div className="rounded-md border p-4 text-center font-mono tracking-widest">
              {state.userCode}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={approve}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              授权
            </button>
            <button
              type="button"
              onClick={deny}
              className="rounded-md border px-4 py-2 hover:bg-muted"
            >
              拒绝
            </button>
          </div>
          <p className="text-center text-muted-foreground text-sm">
            请核对代码是否与终端显示一致后再授权。
          </p>
        </>
      )}

      {state.phase === "approving" && (
        <p className="text-center text-muted-foreground">{state.message}</p>
      )}
    </div>
  );
}

async function safeError(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as {
      error_description?: string;
      message?: string;
    };
    return body.error_description ?? body.message;
  } catch {
    return undefined;
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
