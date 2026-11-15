CREATE TABLE `commission` (
	`base_amount` integer NOT NULL,
	`base_currency` text,
	`cash_amount` integer,
	`commission_credits` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`note` text,
	`order_no` text NOT NULL,
	`rate` integer NOT NULL,
	`referred_user_id` text NOT NULL,
	`referrer_id` text NOT NULL,
	`settled_at` integer,
	`settled_by` text,
	`status` text NOT NULL,
	`transaction_no` text,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`referred_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referrer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commission_order_no_unique` ON `commission` (`order_no`);--> statement-breakpoint
CREATE INDEX `idx_commission_referrer_status` ON `commission` (`referrer_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_commission_status` ON `commission` (`status`);--> statement-breakpoint
CREATE TABLE `referral` (
	`code` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`custom_rate` integer,
	`id` text PRIMARY KEY NOT NULL,
	`note` text DEFAULT '',
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_code_unique` ON `referral` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `referral_user_id_unique` ON `referral` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_referral_code` ON `referral` (`code`);--> statement-breakpoint
CREATE TABLE `referral_relation` (
	`code` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`referrer_id` text NOT NULL,
	`referred_user_id` text NOT NULL,
	FOREIGN KEY (`referrer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referred_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_relation_referred_user_id_unique` ON `referral_relation` (`referred_user_id`);--> statement-breakpoint
CREATE INDEX `idx_referral_relation_referrer` ON `referral_relation` (`referrer_id`);--> statement-breakpoint
CREATE INDEX `idx_referral_relation_code` ON `referral_relation` (`code`);