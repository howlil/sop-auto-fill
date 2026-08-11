ALTER TABLE `PengingatWhatsApp`
  ADD COLUMN `emailNextSendAt` DATETIME(3) NULL,
  ADD COLUMN `emailLastSentAt` DATETIME(3) NULL,
  ADD COLUMN `emailFailures` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `emailLastErrorKind` VARCHAR(64) NULL,
  ADD COLUMN `emailLockedUntil` DATETIME(3) NULL,
  ADD COLUMN `emailLockToken` CHAR(36) NULL,
  ADD COLUMN `inAppReadAt` DATETIME(3) NULL;

UPDATE `PengingatWhatsApp`
SET `emailNextSendAt` = `nextSendAt`
WHERE `emailNextSendAt` IS NULL;

CREATE INDEX `PengingatWhatsApp_email_due_lock_idx`
  ON `PengingatWhatsApp`(`emailNextSendAt`, `emailLockedUntil`);

CREATE INDEX `PengingatWhatsApp_in_app_user_idx`
  ON `PengingatWhatsApp`(`penggunaId`, `inAppReadAt`, `createdAt`);
