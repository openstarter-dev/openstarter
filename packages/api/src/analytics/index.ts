// packages/api/src/analytics —— 站点分析域入口（Analytics_Module，R25）。
//
// 汇总分析服务（service：getAdminMetrics 后台汇总指标 / getPublicAnalyticsConfig 公开分析配置）。
// 管理员指标经通配符 RBAC 保护的管理员路由暴露；公开分析配置经只读端点供 apps/web 条件注入脚本。

export * from "./service";
