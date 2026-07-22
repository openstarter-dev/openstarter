// packages/api/src/tickets —— 工单客服域入口（对齐 ShipAny `modules/tickets`，R21）。
//
// 汇总工单服务（service：createTicket 建单+首条消息 / addMessage 回复并迁移状态 /
// updateTicketStatus 改状态 / sanitizeAttachments 附件校验 / 用户与管理员的分页查询）。
// 访问隔离（普通用户仅本人、管理员经通配符 RBAC 访问全部）由 `routes/tickets` 施加。

export * from "./service";
