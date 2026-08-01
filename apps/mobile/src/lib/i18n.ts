// apps/mobile/src/lib/i18n.ts —— 启动时确定语言，并暴露切换入口。
//
// 初始化刻意放在模块作用域：它只应发生一次，且必须在任何组件读取消息之前完成。
// 放进 useState 初始化器会变成"渲染期副作用"，放进 useEffect 又会让首帧用错语言。
//
// setLocale 传 reload: false —— Paraglide 在 Web 上默认重载页面，原生端没有重载概念，
// 改由 React state 驱动重渲染（见 spec §6 国际化）。
import type { SupportedLocale } from "@openstarter/i18n";
import { getLocales } from "expo-localization";
import { useCallback, useState } from "react";

import { setLocale } from "@/paraglide/runtime.js";

import { resolveInitialLocale } from "./locale";
import { loadLocalePreference, saveLocalePreference } from "./preferences";

const initialLocale = resolveInitialLocale(
  getLocales().map((entry) => entry.languageTag),
  loadLocalePreference()
);

setLocale(initialLocale, { reload: false });

export function useAppLocale() {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);

  const setAppLocale = useCallback((next: SupportedLocale) => {
    saveLocalePreference(next);
    setLocale(next, { reload: false });
    setLocaleState(next);
  }, []);

  return { locale, setAppLocale };
}
