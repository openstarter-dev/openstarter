// packages/api/src/schema —— API 层「类型与校验」的集中地。
//
// 组织方式（与 modules/ 镜像）：
//   - shared.ts：跨域共享 schema（idParam / paginationSchema / createPaginationSchema），
//     经本 barrel 导出。
//   - 各域 schema 从对应子路径导入（如 ../../schema/user、../../schema/admin/rbac），
//     文件内名称按域作用域命名（listQuery / createBody 等），不做 barrel 汇总，
//     以避免跨域同名冲突。
//
// 依赖规则：schema/ 只依赖 zod、schema/ 内部文件与纯类型模块，不反向依赖
// modules/ 的路由或服务 —— 依赖方向恒为 modules → schema。

export { idParam, paginationSchema, createPaginationSchema } from "./shared";
