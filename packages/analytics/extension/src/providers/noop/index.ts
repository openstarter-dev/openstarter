// noop 策略 —— 未配置任何供应商时的空实现。
//
// 复用 @openstarter/analytics/runtime 的同一份实现（三端一致），本文件只作为
// providers/ 目录下的显式占位，便于读者按目录结构找到「无配置时会发生什么」。

export { createNoopProvider } from "@openstarter/analytics/runtime";
