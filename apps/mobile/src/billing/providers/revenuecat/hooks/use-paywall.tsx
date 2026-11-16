import { useState } from "react";
import Purchases from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

import { PaywallResult } from "../../../types";

import { toPaywallResult } from "./to-paywall-result";

import type { PaywallCallbacks } from "../../../types";
import type { Override } from "@openstarter/shared/types";
import type { CustomerInfo } from "react-native-purchases";
import type { PresentPaywallParams } from "react-native-purchases-ui";

type UsePaywallArgs = Override<
  PaywallCallbacks,
  {
    onPresent?: ({ params }: { params: PresentPaywallParams }) => void;
    onPurchase?: ({ customerInfo }: { customerInfo: CustomerInfo }) => void;
    onRestore?: ({ customerInfo }: { customerInfo: CustomerInfo }) => void;
    onError?: (error?: Error) => void;
  }
>;

export const usePaywall = (args?: UsePaywallArgs) => {
  const [result, setResult] = useState<PaywallResult>(PaywallResult.IDLE);

  const present = async ({ trigger, ...params }: PresentPaywallParams & { trigger: string }) => {
    try {
      await Purchases.setAttributes({ trigger });
      args?.onPresent?.({ params });

      const nativeResult = await RevenueCatUI.presentPaywall(params);
      const result = toPaywallResult(nativeResult);
      setResult(result);

      if (nativeResult === PAYWALL_RESULT.NOT_PRESENTED) {
        args?.onSkip?.();
        return;
      }

      args?.onDismiss?.();

      switch (nativeResult) {
        case PAYWALL_RESULT.PURCHASED: {
          const customerInfo = await Purchases.getCustomerInfo();
          args?.onPurchase?.({ customerInfo });
          return;
        }
        case PAYWALL_RESULT.RESTORED: {
          const customerInfo = await Purchases.getCustomerInfo();
          args?.onRestore?.({ customerInfo });
          return;
        }
        case PAYWALL_RESULT.CANCELLED: {
          return;
        }
        case PAYWALL_RESULT.ERROR: {
          args?.onError?.();
          return;
        }
      }
    } catch (error) {
      setResult(PaywallResult.ERROR);
      args?.onError?.(error instanceof Error ? error : undefined);
    }
  };

  return {
    present,
    result,
  };
};
