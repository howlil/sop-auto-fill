-- AlterTable
ALTER TABLE `peraturan` ADD COLUMN `lastEditedById` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Peraturan_lastEditedById_idx` ON `Peraturan`(`lastEditedById`);

-- AddForeignKey
ALTER TABLE `Peraturan` ADD CONSTRAINT `Peraturan_lastEditedById_fkey` FOREIGN KEY (`lastEditedById`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: set lastEditedById untuk data lama (jika ada kandidat admin/biro).
-- Kriteria kandidat: pengguna aktif, peran PJ_EVALUATOR, dan OPD bertanda Biro Organisasi.
UPDATE `Peraturan`
SET `lastEditedById` = (
  SELECT `p`.`penggunaId`
  FROM `Pengguna` `p`
  JOIN `OPD` `o` ON `o`.`opdId` = `p`.`opdId`
  WHERE `p`.`deletedAt` IS NULL
    AND `p`.`peran` = 'PJ_EVALUATOR'
    AND `o`.`isBiroOrganisasi` = TRUE
  ORDER BY `p`.`createdAt` ASC
  LIMIT 1
)
WHERE `lastEditedById` IS NULL;
