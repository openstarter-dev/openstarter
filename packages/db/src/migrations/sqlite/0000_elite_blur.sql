CREATE TABLE `account` (
	`access_token` text,
	`access_token_expires_at` integer,
	`account_id` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`id_token` text,
	`password` text,
	`provider_id` text NOT NULL,
	`refresh_token` text,
	`refresh_token_expires_at` integer,
	`scope` text,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_account_user_id` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_account_provider_account` ON `account` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `ai_task` (
	`cost_credits` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`credit_id` text,
	`deleted_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`media_type` text NOT NULL,
	`model` text NOT NULL,
	`options` text,
	`prompt` text NOT NULL,
	`provider` text NOT NULL,
	`scene` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`task_id` text,
	`task_info` text,
	`task_result` text,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ai_task_user_media_type` ON `ai_task` (`user_id`,`media_type`);--> statement-breakpoint
CREATE INDEX `idx_ai_task_media_type_status` ON `ai_task` (`media_type`,`status`);--> statement-breakpoint
CREATE TABLE `apikey` (
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`status` text NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_apikey_user_status` ON `apikey` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_apikey_keyhash_status` ON `apikey` (`key_hash`,`status`);--> statement-breakpoint
CREATE TABLE `chat` (
	`content` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`metadata` text,
	`model` text NOT NULL,
	`parts` text NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_user_status` ON `chat` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `chat_message` (
	`chat_id` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`metadata` text,
	`model` text NOT NULL,
	`parts` text NOT NULL,
	`provider` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chat`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_message_chat_id` ON `chat_message` (`chat_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_chat_message_user_id` ON `chat_message` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `config` (
	`name` text NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `config_name_unique` ON `config` (`name`);--> statement-breakpoint
CREATE TABLE `credit` (
	`consumed_detail` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`credits` integer NOT NULL,
	`deleted_at` integer,
	`description` text,
	`expires_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`metadata` text,
	`order_no` text,
	`remaining_credits` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`subscription_no` text,
	`transaction_no` text NOT NULL,
	`transaction_scene` text,
	`transaction_type` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_email` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_transaction_no_unique` ON `credit` (`transaction_no`);--> statement-breakpoint
CREATE INDEX `idx_credit_consume_fifo` ON `credit` (`user_id`,`status`,`transaction_type`,`remaining_credits`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_credit_order_no` ON `credit` (`order_no`);--> statement-breakpoint
CREATE INDEX `idx_credit_subscription_no` ON `credit` (`subscription_no`);--> statement-breakpoint
CREATE TABLE `device_code` (
	`client_id` text,
	`device_code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`last_polled_at` integer,
	`polling_interval` integer,
	`scope` text,
	`status` text NOT NULL,
	`user_code` text NOT NULL,
	`user_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_code_device_code_unique` ON `device_code` (`device_code`);--> statement-breakpoint
CREATE INDEX `idx_device_code_user_code` ON `device_code` (`user_code`);--> statement-breakpoint
CREATE INDEX `idx_device_code_status` ON `device_code` (`status`);--> statement-breakpoint
CREATE TABLE `invitation` (
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`inviter_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`team_id` text,
	FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_invitation_organization_id` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_invitation_email` ON `invitation` (`email`);--> statement-breakpoint
CREATE TABLE `invite_code` (
	`code` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text,
	`expires_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`note` text DEFAULT '',
	`trial_days` integer DEFAULT 15 NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_code_code_unique` ON `invite_code` (`code`);--> statement-breakpoint
CREATE INDEX `idx_invite_code_code` ON `invite_code` (`code`);--> statement-breakpoint
CREATE TABLE `member` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_member_organization_id` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_member_user_id` ON `member` (`user_id`);--> statement-breakpoint
CREATE TABLE `order` (
	`amount` integer NOT NULL,
	`callback_url` text,
	`checkout_info` text NOT NULL,
	`checkout_result` text,
	`checkout_url` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`credits_amount` integer,
	`credits_valid_days` integer,
	`currency` text NOT NULL,
	`deleted_at` integer,
	`description` text,
	`discount_amount` integer,
	`discount_code` text,
	`discount_currency` text,
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text,
	`invoice_url` text,
	`order_no` text NOT NULL,
	`paid_at` integer,
	`payment_amount` integer,
	`payment_currency` text,
	`payment_email` text,
	`payment_interval` text,
	`payment_product_id` text,
	`payment_provider` text NOT NULL,
	`payment_result` text,
	`payment_session_id` text,
	`payment_type` text,
	`payment_user_id` text,
	`payment_user_name` text,
	`plan_name` text,
	`product_id` text,
	`product_name` text,
	`status` text NOT NULL,
	`subscription_id` text,
	`subscription_no` text,
	`subscription_result` text,
	`transaction_id` text,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_email` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_order_no_unique` ON `order` (`order_no`);--> statement-breakpoint
CREATE INDEX `idx_order_user_status_payment_type` ON `order` (`user_id`,`status`,`payment_type`);--> statement-breakpoint
CREATE INDEX `idx_order_transaction_provider` ON `order` (`transaction_id`,`payment_provider`);--> statement-breakpoint
CREATE INDEX `idx_order_created_at` ON `order` (`created_at`);--> statement-breakpoint
CREATE TABLE `organization` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`logo` text,
	`metadata` text,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_organization_slug` ON `organization` (`slug`);--> statement-breakpoint
CREATE TABLE `passkey` (
	`aaguid` text,
	`backed_up` integer NOT NULL,
	`counter` integer NOT NULL,
	`created_at` integer,
	`credential_id` text NOT NULL,
	`device_type` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`public_key` text NOT NULL,
	`transports` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_passkey_user_id` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_passkey_credential_id` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE TABLE `permission` (
	`action` text NOT NULL,
	`code` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`description` text,
	`id` text PRIMARY KEY NOT NULL,
	`resource` text NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permission_code_unique` ON `permission` (`code`);--> statement-breakpoint
CREATE INDEX `idx_permission_resource_action` ON `permission` (`resource`,`action`);--> statement-breakpoint
CREATE TABLE `post` (
	`author_image` text,
	`author_name` text,
	`categories` text,
	`content` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	`description` text,
	`id` text PRIMARY KEY NOT NULL,
	`image` text,
	`parent_id` text,
	`slug` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`tags` text,
	`title` text,
	`type` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_slug_unique` ON `post` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_post_type_status` ON `post` (`type`,`status`);--> statement-breakpoint
CREATE TABLE `role` (
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`description` text,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_name_unique` ON `role` (`name`);--> statement-breakpoint
CREATE INDEX `idx_role_status` ON `role` (`status`);--> statement-breakpoint
CREATE TABLE `role_permission` (
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`permission_id` text NOT NULL,
	`role_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`permission_id`) REFERENCES `permission`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_role_permission_role_permission` ON `role_permission` (`role_id`,`permission_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`active_organization_id` text,
	`active_team_id` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`impersonated_by` text,
	`ip_address` text,
	`token` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_session_user_expires` ON `session` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `subscription` (
	`amount` integer,
	`billing_url` text,
	`canceled_at` integer,
	`canceled_end_at` integer,
	`canceled_reason` text,
	`canceled_reason_type` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`credits_amount` integer,
	`credits_valid_days` integer,
	`currency` text,
	`current_period_end` integer,
	`current_period_start` integer,
	`deleted_at` integer,
	`description` text,
	`id` text PRIMARY KEY NOT NULL,
	`interval` text,
	`interval_count` integer,
	`payment_product_id` text,
	`payment_provider` text NOT NULL,
	`payment_user_id` text,
	`plan_name` text,
	`product_id` text,
	`product_name` text,
	`status` text NOT NULL,
	`subscription_id` text NOT NULL,
	`subscription_no` text NOT NULL,
	`subscription_result` text,
	`trial_period_days` integer,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_email` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_subscription_no_unique` ON `subscription` (`subscription_no`);--> statement-breakpoint
CREATE INDEX `idx_subscription_user_status_interval` ON `subscription` (`user_id`,`status`,`interval`);--> statement-breakpoint
CREATE INDEX `idx_subscription_provider_id` ON `subscription` (`subscription_id`,`payment_provider`);--> statement-breakpoint
CREATE INDEX `idx_subscription_created_at` ON `subscription` (`created_at`);--> statement-breakpoint
CREATE TABLE `taxonomy` (
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	`description` text,
	`icon` text,
	`id` text PRIMARY KEY NOT NULL,
	`image` text,
	`parent_id` text,
	`slug` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_slug_unique` ON `taxonomy` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_taxonomy_type_status` ON `taxonomy` (`type`,`status`);--> statement-breakpoint
CREATE TABLE `team` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`organization_id` text NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_team_organization_id` ON `team` (`organization_id`);--> statement-breakpoint
CREATE TABLE `team_member` (
	`created_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_team_member_team_id` ON `team_member` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_team_member_user_id` ON `team_member` (`user_id`);--> statement-breakpoint
CREATE TABLE `ticket` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ticket_user` ON `ticket` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ticket_status` ON `ticket` (`status`);--> statement-breakpoint
CREATE TABLE `ticket_message` (
	`attachments` text DEFAULT '[]' NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`ticket_id` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `ticket`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ticket_message_ticket` ON `ticket_message` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `two_factor` (
	`backup_codes` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`user_id` text NOT NULL,
	`verified` integer DEFAULT true,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_two_factor_secret` ON `two_factor` (`secret`);--> statement-breakpoint
CREATE INDEX `idx_two_factor_user_id` ON `two_factor` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
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
	`role` text,
	`two_factor_enabled` integer DEFAULT false,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`utm_source` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `idx_user_name` ON `user` (`name`);--> statement-breakpoint
CREATE INDEX `idx_user_created_at` ON `user` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_invite` (
	`activated_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`invite_code_id` text NOT NULL,
	`trial_ends_at` integer NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`invite_code_id`) REFERENCES `invite_code`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_invite_user_id_unique` ON `user_invite` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_invite_user` ON `user_invite` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_invite_code` ON `user_invite` (`invite_code_id`);--> statement-breakpoint
CREATE TABLE `user_role` (
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`expires_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_role_user_expires` ON `user_role` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_role_user_role` ON `user_role` (`user_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `verification` (
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_verification_identifier` ON `verification` (`identifier`);