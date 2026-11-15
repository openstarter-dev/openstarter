CREATE TABLE `apikey` (
	`config_id` text DEFAULT 'default' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`expires_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`last_refill_at` integer,
	`last_request` integer,
	`metadata` text,
	`name` text,
	`permissions` text,
	`prefix` text,
	`rate_limit_enabled` integer DEFAULT true NOT NULL,
	`rate_limit_max` integer DEFAULT 10 NOT NULL,
	`rate_limit_time_window` integer DEFAULT 86400000 NOT NULL,
	`reference_id` text NOT NULL,
	`refill_amount` integer,
	`refill_interval` integer,
	`remaining` integer,
	`request_count` integer DEFAULT 0 NOT NULL,
	`start` text,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`reference_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_apikey_reference_id` ON `apikey` (`reference_id`);--> statement-breakpoint
CREATE INDEX `idx_apikey_key` ON `apikey` (`key`);--> statement-breakpoint
CREATE INDEX `idx_apikey_config_id` ON `apikey` (`config_id`);