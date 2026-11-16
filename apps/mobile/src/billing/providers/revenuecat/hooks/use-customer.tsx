import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useCallback, useMemo } from "react";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";

import { MOBILE_STORE_LINKS, MobileStore } from "../../../constants";

import { BillingProvider } from "../../types";
import { ensureConfigured, isRevenueCatAvailable } from "../provider";

export const useCustomer = () => {
  const customer = useQuery({
    queryKey: [BillingProvider.REVENUECAT, "customer"],
    queryFn: () => Purchases.getCustomerInfo(),
    // 未 configure 时 SDK 抛错：query 内部消化为 error 态（不崩 App）。
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });

  const entitlements = useMemo(() => {
    return Object.values(customer.data?.entitlements.all ?? {}).map((entitlement) => ({
      id: entitlement.identifier.toLowerCase(),
      active: entitlement.isActive,
      variantId: entitlement.productIdentifier,
    }));
  }, [customer.data]);

  const identify = useCallback((userId: string, traits?: Record<string, string | null>) => {
    if (!userId) {
      return;
    }
    void (async () => {
      if (!(await ensureConfigured())) {
        return;
      }
      try {
        await Purchases.logIn(userId);
        if (traits) {
          await Purchases.setAttributes(traits);
        }
      } catch {
        // logIn 失败不影响主流程；下次登录或 customerInfo 更新会再同步。
      }
    })();
  }, []);

  const reset = useCallback(() => {
    void (async () => {
      if (!(await ensureConfigured())) {
        return;
      }
      try {
        const isAnonymous = await Purchases.isAnonymous();
        if (isAnonymous) {
          return;
        }
        await Purchases.logOut();
      } catch {
        // 同 identify：静默降级。
      }
    })();
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    if (!(await ensureConfigured())) {
      return false;
    }
    try {
      // SDK 直接返回 CustomerInfo（不是 { customerInfo } 包裹）。
      const customerInfo = await Purchases.restorePurchases();
      return customerInfo.activeSubscriptions.length > 0;
    } catch {
      return false;
    }
  }, []);

  const addCustomerInfoListener = useCallback((listener: () => void) => {
    if (!isRevenueCatAvailable()) {
      return () => undefined;
    }
    // SDK 是「注册引用 + removeListener」模型。
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      try {
        Purchases.removeCustomerInfoUpdateListener(listener);
      } catch {
        // 未初始化/原生端已销毁时移除失败可忽略。
      }
    };
  }, []);

  const linkToPortal = useCallback(
    async ({ store, variantId }: { store: string; variantId?: string }) => {
      if (!Object.values(MobileStore).includes(store as MobileStore)) {
        throw new Error(`Invalid store: ${store}`);
      }

      if (store === MobileStore.APP_STORE && Platform.OS === "ios") {
        return Purchases.showManageSubscriptions();
      }

      const url = MOBILE_STORE_LINKS[store as keyof typeof MOBILE_STORE_LINKS];

      if (store === MobileStore.PLAY_STORE && variantId) {
        await Linking.openURL(`${url}?sku=${encodeURIComponent(variantId)}`);
        return;
      }

      await Linking.openURL(url);
    },
    [],
  );

  return {
    identify,
    reset,
    restore,
    addCustomerInfoListener,
    customer: customer.data,
    entitlements,
    linkToPortal,
  } as const;
};
