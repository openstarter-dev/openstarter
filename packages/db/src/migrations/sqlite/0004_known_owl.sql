-- 平台角色迁移：四表 RBAC → `user.role` 单字段（配合 better-auth admin 插件）。
--
-- 这一步不可逆：先按「最高角色」把 user_role 的有效角色回填进 user.role，
-- 再删除 role / permission / role_permission / user_role。
-- 回滚需要从备份恢复这四张表；角色与权限码的映射已在代码中
-- （packages/auth/src/rbac/permissions.ts，角色集 = admin / user）。
--
-- 仅回填 role 仍为 NULL 的用户；过期的 user_role 不参与回填。
UPDATE `user`
SET `role` = CASE
  WHEN EXISTS (
    SELECT 1
    FROM `user_role` `ur`
    INNER JOIN `role` `r` ON `r`.`id` = `ur`.`role_id`
    WHERE `ur`.`user_id` = `user`.`id`
      AND `r`.`name` IN ('admin', 'super_admin')
      AND (`ur`.`expires_at` IS NULL
        OR `ur`.`expires_at` > (CAST((JULIANDAY('now') - 2440587.5) * 86400000 AS INTEGER)))
  ) THEN 'admin'
  ELSE 'user'
END
WHERE `user`.`role` IS NULL
  AND EXISTS (
    SELECT 1 FROM `user_role` `ur2` WHERE `ur2`.`user_id` = `user`.`id`
  );--> statement-breakpoint
DROP TABLE `permission`;--> statement-breakpoint
DROP TABLE `role`;--> statement-breakpoint
DROP TABLE `role_permission`;--> statement-breakpoint
DROP TABLE `user_role`;
