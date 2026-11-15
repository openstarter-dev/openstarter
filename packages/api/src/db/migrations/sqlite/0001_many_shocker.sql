CREATE TABLE `ai_model` (
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`credit_price` integer DEFAULT 0 NOT NULL,
	`display_name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`max_output_tokens` integer,
	`media_type` text NOT NULL,
	`metadata` text,
	`model_id` text NOT NULL,
	`options_schema` text,
	`provider` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_model_enabled_media` ON `ai_model` (`enabled`,`media_type`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ai_model_provider_model` ON `ai_model` (`provider`,`model_id`);