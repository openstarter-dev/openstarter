// @openstarter/shared 包入口。
// 聚合本任务（3.3）落位的公共 API：响应封装、共享常量、日志与共享类型。
// 说明：id/hash/crypto（并行任务 3.1）与 config（任务 3.4）暂不在此 re-export，
// 待其全部落位后统一整理，避免破坏并行任务的产出。
export * from "./constants";
export * from "./logger";
export * from "./resp";
export * from "./types";
