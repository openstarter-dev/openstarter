// 客户端所需商店常量（上游复制自 @workspace/billing，本仓库就地下放；spec §5）。
// 链接表为「管理订阅」的商店深链兜底，可按运营需要调整。

export const MobileStore = {
  APP_STORE: "app_store",
  PLAY_STORE: "play_store",
} as const;

export type MobileStore = (typeof MobileStore)[keyof typeof MobileStore];

export const MOBILE_STORE_LINKS: Readonly<Record<MobileStore, string>> = {
  [MobileStore.APP_STORE]: "https://apps.apple.com/account/subscriptions",
  [MobileStore.PLAY_STORE]: "https://play.google.com/store/account/subscriptions",
};
