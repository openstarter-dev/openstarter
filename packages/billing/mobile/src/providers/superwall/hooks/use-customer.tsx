import * as Linking from "expo-linking";
import { useUser } from "expo-superwall";
import { useCallback, useMemo } from "react";

import { MOBILE_STORE_LINKS, MobileStore } from "../../../constants";

export const useCustomer = () => {
  const user = useUser();

  const entitlements = useMemo(() => {
    return user.subscriptionStatus.status === "ACTIVE"
      ? user.subscriptionStatus.entitlements.map((entitlement) => ({
          id: entitlement.id.toLowerCase(),
          active: true,
        }))
      : [];
  }, [user.subscriptionStatus]);

  const identify = useCallback(
    (userId: string, traits?: Record<string, string | null>) => {
      void user.identify(userId).then(() => {
        if (traits) {
          // identify 的第二参是 IdentifyOptions（非 traits）；attributes 走 update。
          return user.update(traits);
        }
      });
    },
    [user],
  );

  const reset = useCallback(() => {
    void user.signOut();
  }, [user]);

  // 备胎态 stub（spec §8.2）：激活 Superwall 时按 expo-superwall 实际导出的
  // restore API 实现并返回真实布尔。契约与 RC 一致（Promise<boolean>，不抛错）。
  const restore = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

  // useUser 为响应式订阅（状态经 React 树传播），无需独立推送通道。
  const addCustomerInfoListener = useCallback((_listener: () => void) => () => undefined, []);

  const linkToPortal = useCallback(
    async ({ store, variantId }: { store: string; variantId?: string }) => {
      if (!Object.values(MobileStore).includes(store as MobileStore)) {
        throw new Error(`Invalid store: ${store}`);
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
    customer: user.user,
    entitlements,
    linkToPortal,
  } as const;
};
