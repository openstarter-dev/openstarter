import { usePlacement } from "expo-superwall";

import { toPaywallResult } from "./to-paywall-result";

import type { PaywallCallbacks } from "../../../types";
import type { Override } from "@openstarter/shared/types";
import type { RegisterPlacementArgs, usePlacementCallbacks } from "expo-superwall";

type UsePaywallArgs = Override<PaywallCallbacks, usePlacementCallbacks>;

export function usePaywall(args?: UsePaywallArgs) {
  const { registerPlacement, state } = usePlacement(
    args
      ? {
          ...args,
          onDismiss: (paywallInfo, result) => {
            args.onDismiss?.(paywallInfo, result);

            if (result.type === "purchased") {
              args.onPurchase?.(paywallInfo, result);
            }

            if (result.type === "restored") {
              args.onRestore?.(paywallInfo, result);
            }
          },
        }
      : undefined,
  );

  const present = async ({
    trigger,
    ...params
  }: Omit<RegisterPlacementArgs, "placement"> & { trigger: string }) => {
    await registerPlacement({ ...params, placement: trigger });
  };

  return { present, result: toPaywallResult(state) };
}
