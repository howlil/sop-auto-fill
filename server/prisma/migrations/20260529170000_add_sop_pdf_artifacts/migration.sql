ALTER TABLE `DokumenTte`
  ADD COLUMN `pdfPath` TEXT NULL,
  ADD COLUMN `pdfSha256` VARCHAR(191) NULL,
  ADD COLUMN `pdfSizeBytes` INTEGER NULL,
  ADD COLUMN `pdfGeneratedAt` DATETIME(3) NULL,
  ADD COLUMN `pdfPublishedAt` DATETIME(3) NULL,
  ADD COLUMN `pdfRevokedAt` DATETIME(3) NULL,
  ADD COLUMN `pdfStatus` VARCHAR(32) NULL;

CREATE INDEX `DokumenTte_jenisDokumen_pdfStatus_idx`
  ON `DokumenTte`(`jenisDokumen`, `pdfStatus`);
