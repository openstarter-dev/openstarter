import { m } from "@openstarter/i18n-web/messages";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import { buildPageTitle } from "@/lib/page-head";
import { approveDevice, claimDevice, denyDevice, DeviceFlowError } from "@/modules/device/lib/api";

type Phase = "claiming" | "ready" | "approving" | "approved" | "denied" | "error";

interface DeviceState {
  message: string;
  phase: Phase;
  userCode?: string;
}

function statusMessage(phase: Phase): string {
  switch (phase) {
    case "approved": {
      return m["common.device.approved_title"]();
    }
    case "approving": {
      return m["common.device.approving"]();
    }
    case "claiming": {
      return m["common.device.claiming"]();
    }
    case "denied": {
      return m["common.device.denied_title"]();
    }
    case "error": {
      return m["common.device.error_title"]();
    }
    case "ready": {
      return m["common.device.ready_prompt"]();
    }
  }
}

function flowErrorMessage(
  err: unknown,
  fallbacks: { rejected: string; requestFailed: string },
): string {
  if (err instanceof DeviceFlowError) {
    return err.detail || fallbacks.rejected;
  }
  return fallbacks.requestFailed;
}

const deviceSearchSchema = z.object({ user_code: z.string().optional() });

export const Route = createFileRoute("/_app/device")({
  component: DeviceAuthPage,
  head: () => buildPageTitle(m["common.device.page_title"]()),
  ssr: false,
  validateSearch: deviceSearchSchema,
});

function DeviceAuthPage() {
  const search = Route.useSearch();
  const initialUserCode = search.user_code?.trim() || undefined;

  const [state, setState] = useState<DeviceState>({
    message: statusMessage("claiming"),
    phase: "claiming",
  });

  useEffect(() => {
    let cancelled = false;
    const userCode = initialUserCode;
    if (!userCode) {
      setState({
        message: m["common.device.missing_code"](),
        phase: "error",
      });
      return;
    }

    const loadClaim = async () => {
      try {
        await claimDevice(userCode);
        if (!cancelled) {
          setState({
            message: statusMessage("ready"),
            phase: "ready",
            userCode,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            message: flowErrorMessage(err, {
              rejected: m["common.device.unrecognized_code"](),
              requestFailed: m["common.device.network_error"](),
            }),
            phase: "error",
            userCode,
          });
        }
      }
    };

    loadClaim();

    return () => {
      cancelled = true;
    };
  }, [initialUserCode]);

  const approve = async () => {
    if (!state.userCode) {
      return;
    }
    setState({
      message: statusMessage("approving"),
      phase: "approving",
      userCode: state.userCode,
    });
    try {
      await approveDevice(state.userCode);
      setState({ message: statusMessage("approved"), phase: "approved" });
    } catch (err) {
      setState({
        message: flowErrorMessage(err, {
          rejected: m["common.device.approve_failed"](),
          requestFailed: m["common.device.network_error"](),
        }),
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
      await denyDevice(state.userCode);
      setState({ message: statusMessage("denied"), phase: "denied" });
    } catch (err) {
      setState({
        message: flowErrorMessage(err, {
          rejected: m["common.device.deny_failed"](),
          requestFailed: m["common.device.network_error"](),
        }),
        phase: "error",
        userCode: state.userCode,
      });
    }
  };

  if (state.phase === "approved") {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">✓</div>
        <h1 className="font-bold text-2xl">{m["common.device.approved_title"]()}</h1>
        <p className="text-muted-foreground">{m["common.device.approved_message"]()}</p>
      </div>
    );
  }

  if (state.phase === "denied") {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">✕</div>
        <h1 className="font-bold text-2xl">{m["common.device.denied_title"]()}</h1>
        <p className="text-muted-foreground">{m["common.device.denied_message"]()}</p>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">✕</div>
        <h1 className="font-bold text-2xl">{m["common.device.error_title"]()}</h1>
        <p className="text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-center">
        <h1 className="font-bold text-2xl">{m["common.device.page_title"]()}</h1>
        <p className="text-muted-foreground">{m["common.device.page_subtitle"]()}</p>
      </div>

      {state.phase === "claiming" && (
        <p className="text-center text-muted-foreground">{state.message}</p>
      )}

      {state.phase === "ready" && (
        <>
          {state.userCode !== undefined && (
            <div className="rounded-md border p-4 text-center font-mono tracking-widest">
              {state.userCode}
            </div>
          )}
          <div className="flex gap-3">
            <button
              className="flex-1 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                void approve();
              }}
              type="button"
            >
              {m["common.device.approve_button"]()}
            </button>
            <button
              className="rounded-md border px-4 py-2 hover:bg-muted"
              onClick={() => {
                void deny();
              }}
              type="button"
            >
              {m["common.device.deny_button"]()}
            </button>
          </div>
          <p className="text-center text-muted-foreground text-sm">
            {m["common.device.verify_hint"]()}
          </p>
        </>
      )}

      {state.phase === "approving" && (
        <p className="text-center text-muted-foreground">{state.message}</p>
      )}
    </div>
  );
}
