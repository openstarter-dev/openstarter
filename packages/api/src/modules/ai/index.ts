// packages/api/src/ai —— AI 供应商域入口（对齐 ShipAny `core/ai`，R19）。
//
// 汇总供应商抽象与归一化类型（types）、可识别/结构化错误（errors）、供应商管理器与按 Config
// 动态装配 + setSaveFiles 注入（manager）、Replicate（主）/Fal 供应商实现，以及供应商路由分派
// 与错误处理（service）。业务侧（如任务 27 的 ai-tasks）从此子域消费统一抽象，不感知渠道差异。

export * from "./errors";
export * from "./fal";
export * from "./manager";
export * from "./replicate";
export * from "./service";
export * from "./types";
