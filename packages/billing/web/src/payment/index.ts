// @openstarter/billing-web/payment 子域入口（对齐 ShipAny `core/payment` + `modules/payment`）。
//
// 汇总支付渠道抽象与归一化类型（types）、渠道管理器与按 Config 动态装配（manager）、
// 四渠道 provider（stripe/paypal/alipay/wechat）与结账编排（checkout）。业务侧从此
// 子路径消费统一抽象，不感知具体渠道差异。

export * from "./alipay";
export * from "./checkout";
export * from "./manager";
export * from "./paypal";
export * from "./stripe";
export * from "./types";
export * from "./webhook";
export * from "./wechat";
