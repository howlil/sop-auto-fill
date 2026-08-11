-- LogNilaiEvaluasi: surrogate -> PK komposit (pengajuanEvaluasiId, detailSopId, penggunaId, createdAt); evaluatorId -> penggunaId; FK ke NilaiEvaluasi.

ALTER TABLE `LogNilaiEvaluasi` ADD COLUMN `penggunaId` VARCHAR(191) NULL;
UPDATE `LogNilaiEvaluasi` SET `penggunaId` = `evaluatorId`;
ALTER TABLE `LogNilaiEvaluasi` MODIFY `penggunaId` VARCHAR(191) NOT NULL;

-- Pastikan unik sebelum PK komposit (tabrakan createdAt pada batch INSERT).
UPDATE `LogNilaiEvaluasi` AS `l`
INNER JOIN (
  SELECT
    `logNilaiEvaluasiId`,
    ROW_NUMBER() OVER (
      PARTITION BY `pengajuanEvaluasiId`, `detailSopId`, `penggunaId`, `createdAt`
      ORDER BY `logNilaiEvaluasiId`
    ) AS `rn`
  FROM `LogNilaiEvaluasi`
) AS `d` ON `l`.`logNilaiEvaluasiId` = `d`.`logNilaiEvaluasiId` AND `d`.`rn` > 1
SET `l`.`createdAt` = DATE_ADD(`l`.`createdAt`, INTERVAL (`d`.`rn` - 1) MICROSECOND);

ALTER TABLE `LogNilaiEvaluasi` DROP FOREIGN KEY `LogNilaiEvaluasi_evaluatorId_fkey`;
ALTER TABLE `LogNilaiEvaluasi` DROP PRIMARY KEY;
ALTER TABLE `LogNilaiEvaluasi` DROP COLUMN `logNilaiEvaluasiId`;
ALTER TABLE `LogNilaiEvaluasi` DROP COLUMN `evaluatorId`;

ALTER TABLE `LogNilaiEvaluasi` ADD PRIMARY KEY (`pengajuanEvaluasiId`, `detailSopId`, `penggunaId`, `createdAt`);

ALTER TABLE `LogNilaiEvaluasi` ADD CONSTRAINT `LogNilaiEvaluasi_penggunaId_fkey` FOREIGN KEY (`penggunaId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `LogNilaiEvaluasi` ADD CONSTRAINT `LogNilaiEvaluasi_pengajuanEvaluasiId_detailSopId_fkey` FOREIGN KEY (`pengajuanEvaluasiId`, `detailSopId`) REFERENCES `NilaiEvaluasi`(`pengajuanEvaluasiId`, `detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX `LogNilaiEvaluasi_detailSopId_createdAt_idx` ON `LogNilaiEvaluasi`(`detailSopId`, `createdAt`);
