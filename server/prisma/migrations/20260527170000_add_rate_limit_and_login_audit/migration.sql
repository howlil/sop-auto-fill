CREATE TABLE IF NOT EXISTS `rate_limit_bucket` (
  `bucket_key` VARCHAR(191) NOT NULL,
  `scope` VARCHAR(64) NOT NULL,
  `identity_hash` CHAR(64) NOT NULL,
  `window_start` DATETIME(3) NOT NULL,
  `window_end` DATETIME(3) NOT NULL,
  `request_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`bucket_key`),
  INDEX `idx_rate_limit_scope_window` (`scope`, `window_end`),
  INDEX `idx_rate_limit_identity_window` (`scope`, `identity_hash`, `window_end`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auth_login_attempt` (
  `auth_login_attempt_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(191) NOT NULL,
  `email_hash` CHAR(64) NOT NULL,
  `client_ip` VARCHAR(64) NOT NULL,
  `client_ip_hash` CHAR(64) NOT NULL,
  `user_agent` VARCHAR(512) NULL,
  `failure_reason` VARCHAR(64) NULL,
  `success` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`auth_login_attempt_id`),
  INDEX `idx_auth_login_attempt_created` (`created_at`),
  INDEX `idx_auth_login_attempt_email_created` (`email_hash`, `created_at`),
  INDEX `idx_auth_login_attempt_ip_created` (`client_ip_hash`, `created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
