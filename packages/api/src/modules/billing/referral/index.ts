// 分销域 barrel（任务 3）。Ruling B：宽带导出整张分销 surface，供 packages/api 等上游
// 直接 import（无需深入子路径）——既包含任务 2 的佣金数学（纯函数 + 常量 + schema），
// 也包含任务 3 的记账服务（recordCommission / getReferralConfig）。

export * from "./commission";
export * from "./service";
