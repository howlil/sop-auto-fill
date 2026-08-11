-- AlterTable
ALTER TABLE `logeditsop` ADD COLUMN `bagian` ENUM('HEADER', 'LANGKAH', 'STATUS', 'KOMENTAR', 'EVALUASI') NOT NULL DEFAULT 'HEADER',
    ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `entityId` VARCHAR(191) NULL,
    ADD COLUMN `meta` JSON NULL;

-- Backfill: tutup semua sesi log lama agar tidak digabung dengan log baru.
UPDATE `LogEditSOP` SET `closedAt` = `createdAt` WHERE `closedAt` IS NULL;

-- CreateIndex
CREATE INDEX `LogEditSOP_detailSopId_userId_bagian_closedAt_idx` ON `LogEditSOP`(`detailSopId`, `userId`, `bagian`, `closedAt`);

-- CreateIndex
CREATE INDEX `LogEditSOP_detailSopId_createdAt_idx` ON `LogEditSOP`(`detailSopId`, `createdAt`);
