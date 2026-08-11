-- =========================================================================
-- Migrasi: tambah audit columns + invariant organisasi (slot kepala / PJ /
-- PenugasanPjEvaluator + flag isBiroOrganisasi) + trigger MySQL.
-- =========================================================================

-- DropForeignKey
ALTER TABLE `riwayatopdpengguna` DROP FOREIGN KEY `RiwayatOpdPengguna_penggunaId_fkey`;

-- DropIndex
DROP INDEX `RiwayatOpdPengguna_penggunaId_mulaiPada_key` ON `riwayatopdpengguna`;

-- AlterTable
ALTER TABLE `dasarhukum` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `detailsoppelaksana` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `dokumentte` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `lampiranteks` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `logeditsop` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `lognilaievaluasi` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `opd` ADD COLUMN `isBiroOrganisasi` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `kepalaPenggunaId` VARCHAR(191) NULL,
    ADD COLUMN `pjPenyusunPenggunaId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `opdperaturan` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `posisinodediagram` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `riwayatopdpengguna` DROP PRIMARY KEY,
    DROP COLUMN `alasan`,
    DROP COLUMN `berakhirPada`,
    DROP COLUMN `mulaiPada`,
    DROP COLUMN `riwayatOpdPenggunaId`,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`penggunaId`, `opdId`);

-- AddForeignKey (FK penggunaId dilepas di atas agar bisa ubah PK; pasang kembali sesuai schema Prisma)
ALTER TABLE `riwayatopdpengguna` ADD CONSTRAINT `RiwayatOpdPengguna_penggunaId_fkey` FOREIGN KEY (`penggunaId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `riwayattandatangan` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `sisidiagram` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `sopterkait` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `titiksisidiagram` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `PenugasanPjEvaluator` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `penggunaId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PenugasanPjEvaluator_penggunaId_key`(`penggunaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `OPD_kepalaPenggunaId_key` ON `OPD`(`kepalaPenggunaId`);

-- CreateIndex
CREATE UNIQUE INDEX `OPD_pjPenyusunPenggunaId_key` ON `OPD`(`pjPenyusunPenggunaId`);

-- AddForeignKey
ALTER TABLE `OPD` ADD CONSTRAINT `OPD_kepalaPenggunaId_fkey` FOREIGN KEY (`kepalaPenggunaId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OPD` ADD CONSTRAINT `OPD_pjPenyusunPenggunaId_fkey` FOREIGN KEY (`pjPenyusunPenggunaId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PenugasanPjEvaluator` ADD CONSTRAINT `PenugasanPjEvaluator_penggunaId_fkey` FOREIGN KEY (`penggunaId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- =========================================================================
-- Trigger 2.1 — Maksimal satu OPD dengan isBiroOrganisasi = TRUE
-- =========================================================================
DROP TRIGGER IF EXISTS `trg_opd_max_one_biro_insert`;
CREATE TRIGGER `trg_opd_max_one_biro_insert`
BEFORE INSERT ON `OPD`
FOR EACH ROW
BEGIN
  IF NEW.`isBiroOrganisasi` = TRUE THEN
    IF (SELECT COUNT(*) FROM `OPD` WHERE `isBiroOrganisasi` = TRUE) > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hanya satu OPD yang boleh ditandai sebagai Biro Organisasi';
    END IF;
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_opd_max_one_biro_update`;
CREATE TRIGGER `trg_opd_max_one_biro_update`
BEFORE UPDATE ON `OPD`
FOR EACH ROW
BEGIN
  IF NEW.`isBiroOrganisasi` = TRUE AND (OLD.`isBiroOrganisasi` IS NULL OR OLD.`isBiroOrganisasi` = FALSE) THEN
    IF (SELECT COUNT(*) FROM `OPD` WHERE `isBiroOrganisasi` = TRUE AND `opdId` <> NEW.`opdId`) > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hanya satu OPD yang boleh ditandai sebagai Biro Organisasi';
    END IF;
  END IF;
END;

-- =========================================================================
-- Trigger 2.2 — PJ_EVALUATOR / EVALUATOR harus dari OPD Biro
-- =========================================================================
DROP TRIGGER IF EXISTS `trg_pengguna_evaluator_from_biro_insert`;
CREATE TRIGGER `trg_pengguna_evaluator_from_biro_insert`
BEFORE INSERT ON `Pengguna`
FOR EACH ROW
BEGIN
  IF NEW.`peran` IN ('PJ_EVALUATOR','EVALUATOR') THEN
    IF (SELECT `isBiroOrganisasi` FROM `OPD` WHERE `opdId` = NEW.`opdId`) <> TRUE THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pengguna dengan peran tim evaluasi harus berasal dari OPD Biro Organisasi';
    END IF;
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_pengguna_evaluator_from_biro_update`;
CREATE TRIGGER `trg_pengguna_evaluator_from_biro_update`
BEFORE UPDATE ON `Pengguna`
FOR EACH ROW
BEGIN
  IF NEW.`peran` IN ('PJ_EVALUATOR','EVALUATOR') THEN
    IF (SELECT `isBiroOrganisasi` FROM `OPD` WHERE `opdId` = NEW.`opdId`) <> TRUE THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pengguna dengan peran tim evaluasi harus berasal dari OPD Biro Organisasi';
    END IF;
  END IF;
END;

-- =========================================================================
-- Trigger 2.3 — Konsistensi pointer kepala/PJ penyusun dengan keanggotaan
-- =========================================================================
DROP TRIGGER IF EXISTS `trg_opd_kepala_pj_konsisten_insert`;
CREATE TRIGGER `trg_opd_kepala_pj_konsisten_insert`
BEFORE INSERT ON `OPD`
FOR EACH ROW
BEGIN
  IF NEW.`kepalaPenggunaId` IS NOT NULL THEN
    IF (SELECT `opdId` FROM `Pengguna` WHERE `penggunaId` = NEW.`kepalaPenggunaId`) <> NEW.`opdId` THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Kepala OPD harus pengguna yang bertugas di OPD ini';
    END IF;
  END IF;
  IF NEW.`pjPenyusunPenggunaId` IS NOT NULL THEN
    IF (SELECT `opdId` FROM `Pengguna` WHERE `penggunaId` = NEW.`pjPenyusunPenggunaId`) <> NEW.`opdId` THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PJ Penyusun OPD harus pengguna yang bertugas di OPD ini';
    END IF;
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_opd_kepala_pj_konsisten_update`;
CREATE TRIGGER `trg_opd_kepala_pj_konsisten_update`
BEFORE UPDATE ON `OPD`
FOR EACH ROW
BEGIN
  IF NEW.`kepalaPenggunaId` IS NOT NULL THEN
    IF (SELECT `opdId` FROM `Pengguna` WHERE `penggunaId` = NEW.`kepalaPenggunaId`) <> NEW.`opdId` THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Kepala OPD harus pengguna yang bertugas di OPD ini';
    END IF;
  END IF;
  IF NEW.`pjPenyusunPenggunaId` IS NOT NULL THEN
    IF (SELECT `opdId` FROM `Pengguna` WHERE `penggunaId` = NEW.`pjPenyusunPenggunaId`) <> NEW.`opdId` THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PJ Penyusun OPD harus pengguna yang bertugas di OPD ini';
    END IF;
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_pengguna_pindah_lepas_slot`;
CREATE TRIGGER `trg_pengguna_pindah_lepas_slot`
BEFORE UPDATE ON `Pengguna`
FOR EACH ROW
BEGIN
  IF NEW.`opdId` <> OLD.`opdId` THEN
    IF (SELECT COUNT(*) FROM `OPD` WHERE `kepalaPenggunaId` = OLD.`penggunaId`) > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lepas slot Kepala OPD lama sebelum memindahkan pengguna';
    END IF;
    IF (SELECT COUNT(*) FROM `OPD` WHERE `pjPenyusunPenggunaId` = OLD.`penggunaId`) > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lepas slot PJ Penyusun OPD lama sebelum memindahkan pengguna';
    END IF;
  END IF;
END;
