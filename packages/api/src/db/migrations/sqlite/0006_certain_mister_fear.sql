-- better-auth 1.7 要求 user_code 唯一。设备码是短时效凭证，先按到期时间保留最新一条，
-- 其余重复行删除，避免建唯一索引时失败。
DELETE FROM `device_code`
WHERE `id` NOT IN (
  SELECT `id` FROM (
    SELECT `id`,
           ROW_NUMBER() OVER (PARTITION BY `user_code` ORDER BY `expires_at` DESC) AS rn
    FROM `device_code`
  )
  WHERE rn = 1
);--> statement-breakpoint
DROP INDEX `idx_device_code_user_code`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_device_code_user_code` ON `device_code` (`user_code`);