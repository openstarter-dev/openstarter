// Single drizzle-orm boundary: only this directory (packages/api/src/db) declares drizzle-orm directly.
// Other packages must import query operators from here ("@openstarter/api/db/orm"),
// never from "drizzle-orm" itself.
// drizzle-orm 唯一收口：其他包一律从这里 import 查询操作符，不直接依赖 drizzle-orm。
export * from "drizzle-orm";
