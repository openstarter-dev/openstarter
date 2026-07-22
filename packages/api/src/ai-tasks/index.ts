// packages/api/src/ai-tasks —— AI 任务与积分联动域入口（对齐 ShipAny `modules/ai-tasks`，R20）。
//
// 汇总任务生命周期服务（service：createTask 原子扣减 / updateTask 失败撤销·成功保留 / getTasks
// 分页筛选）与生成文件转存对象存储的桥接注入（save-files：setSaveFiles 组合根接线，R19.1 收尾）。
// 业务侧经 AI 域（`../ai`）统一抽象发起生成，本域负责把「任务状态」与「按量扣费」原子联动。

export * from "./save-files";
export * from "./service";
