PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- 历史行可能为 NULL（旧 seed / 直接 SQL 插入）：先归一为默认角色，再按 NOT NULL 重建表。
UPDATE `user` SET `role` = 'user' WHERE `role` IS NULL;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`ban_expires` integer,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`image` text,
	`ip` text DEFAULT '' NOT NULL,
	`is_anonymous` integer DEFAULT false,
	`locale` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`two_factor_enabled` integer DEFAULT false,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`utm_source` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`("ban_expires", "banned", "ban_reason", "created_at", "email", "email_verified", "id", "image", "ip", "is_anonymous", "locale", "name", "role", "two_factor_enabled", "updated_at", "utm_source") SELECT "ban_expires", "banned", "ban_reason", "created_at", "email", "email_verified", "id", "image", "ip", "is_anonymous", "locale", "name", "role", "two_factor_enabled", "updated_at", "utm_source" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `idx_user_name` ON `user` (`name`);--> statement-breakpoint
CREATE INDEX `idx_user_created_at` ON `user` (`created_at`);