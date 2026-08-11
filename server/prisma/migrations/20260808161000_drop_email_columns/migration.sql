-- DropIndex
-- DROP INDEX `PengingatWhatsApp_email_due_lock_idx` ON `PengingatWhatsApp`;

-- AlterTable
ALTER TABLE `PengingatWhatsApp` DROP COLUMN `emailFailures`,
    DROP COLUMN `emailLastErrorKind`,
    DROP COLUMN `emailLastSentAt`,
    DROP COLUMN `emailLockToken`,
    DROP COLUMN `emailLockedUntil`,
    DROP COLUMN `emailNextSendAt`,
    ADD COLUMN `resolvedAt` DATETIME(3) NULL,
    MODIFY `nomorTujuan` VARCHAR(20) NOT NULL;
