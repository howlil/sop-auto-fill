-- Refactor istilah peran (koordinator→PJ Penyusun, biro→PJ Evaluator, tim evaluasi→Evaluator, tim penyusun→Penyusun)
-- Target: rename kolom + migrate nilai ENUM lama -> baru dengan urutan aman untuk MySQL.

-- 1) OPD: rename kolom penanda biro organisasi -> PJ evaluator organisasi (preserve data).
--    Dibuat defensif (ada DB lama yang belum punya kolom / sudah ter-rename).
SET @hasOldOpdFlag := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'opd'
    AND COLUMN_NAME = 'isBiroOrganisasi'
);
SET @hasNewOpdFlag := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'opd'
    AND COLUMN_NAME = 'isPjEvaluatorOrganisasi'
);
SET @sqlOpdFlag := IF(
  @hasNewOpdFlag > 0,
  'SELECT 1',
  IF(
    @hasOldOpdFlag > 0,
    'ALTER TABLE `OPD` CHANGE COLUMN `isBiroOrganisasi` `isPjEvaluatorOrganisasi` TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE `OPD` ADD COLUMN `isPjEvaluatorOrganisasi` BOOLEAN NOT NULL DEFAULT false'
  )
);
PREPARE stmt FROM @sqlOpdFlag;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update trigger invariant "maksimal satu OPD" ke kolom baru.
DROP TRIGGER IF EXISTS `trg_opd_max_one_biro_insert`;
DROP TRIGGER IF EXISTS `trg_opd_max_one_biro_update`;
DROP TRIGGER IF EXISTS `trg_opd_max_one_pj_evaluator_org_insert`;
DROP TRIGGER IF EXISTS `trg_opd_max_one_pj_evaluator_org_update`;

CREATE TRIGGER `trg_opd_max_one_pj_evaluator_org_insert`
BEFORE INSERT ON `OPD`
FOR EACH ROW
BEGIN
  IF NEW.`isPjEvaluatorOrganisasi` = TRUE THEN
    IF (SELECT COUNT(*) FROM `OPD` WHERE `isPjEvaluatorOrganisasi` = TRUE) > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hanya satu OPD yang boleh ditandai sebagai PJ Evaluator Organisasi';
    END IF;
  END IF;
END;

CREATE TRIGGER `trg_opd_max_one_pj_evaluator_org_update`
BEFORE UPDATE ON `OPD`
FOR EACH ROW
BEGIN
  IF NEW.`isPjEvaluatorOrganisasi` = TRUE AND (OLD.`isPjEvaluatorOrganisasi` IS NULL OR OLD.`isPjEvaluatorOrganisasi` = FALSE) THEN
    IF (SELECT COUNT(*) FROM `OPD` WHERE `isPjEvaluatorOrganisasi` = TRUE AND `opdId` <> NEW.`opdId`) > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hanya satu OPD yang boleh ditandai sebagai PJ Evaluator Organisasi';
    END IF;
  END IF;
END;

-- 2) PengajuanEvaluasi: rename kolom koordinator -> PJ penyusun (preserve data).
SET @hasOldSignUser := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pengajuanevaluasi'
    AND COLUMN_NAME = 'ditandatanganiOlehKoordinatorUserId'
);
SET @hasNewSignUser := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pengajuanevaluasi'
    AND COLUMN_NAME = 'ditandatanganiOlehPjPenyusunUserId'
);
SET @sqlSignUser := IF(
  @hasNewSignUser > 0,
  'SELECT 1',
  IF(
    @hasOldSignUser > 0,
    'ALTER TABLE `PengajuanEvaluasi` CHANGE COLUMN `ditandatanganiOlehKoordinatorUserId` `ditandatanganiOlehPjPenyusunUserId` VARCHAR(191) NULL',
    'ALTER TABLE `PengajuanEvaluasi` ADD COLUMN `ditandatanganiOlehPjPenyusunUserId` VARCHAR(191) NULL'
  )
);
PREPARE stmt FROM @sqlSignUser;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @hasOldSignDate := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pengajuanevaluasi'
    AND COLUMN_NAME = 'tanggalTTDBaKoordinator'
);
SET @hasNewSignDate := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pengajuanevaluasi'
    AND COLUMN_NAME = 'tanggalTTDBaPjPenyusun'
);
SET @sqlSignDate := IF(
  @hasNewSignDate > 0,
  'SELECT 1',
  IF(
    @hasOldSignDate > 0,
    'ALTER TABLE `PengajuanEvaluasi` CHANGE COLUMN `tanggalTTDBaKoordinator` `tanggalTTDBaPjPenyusun` DATETIME(3) NULL',
    'ALTER TABLE `PengajuanEvaluasi` ADD COLUMN `tanggalTTDBaPjPenyusun` DATETIME(3) NULL'
  )
);
PREPARE stmt FROM @sqlSignDate;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) StatusSOP: tambahkan value baru dulu (enum column di MySQL), migrasikan data, lalu hapus value lama.
ALTER TABLE `DetailSOP`
  MODIFY `status` ENUM(
    'DRAFT',
    'SEDANG_DISUSUN',
    'SIAP_DIEVALUASI',
    'DIAJUKAN_EVALUASI',
    'SEDANG_DIEVALUASI',
    'REVISI_DARI_TIM_EVALUASI',
    'REVISI_DARI_EVALUATOR',
    'SIAP_DIVERIFIKASI',
    'DIVERIFIKASI_BIRO_ORGANISASI',
    'DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI',
    'BERLAKU',
    'DIGANTIKAN',
    'DICABUT'
  ) NOT NULL DEFAULT 'DRAFT';

UPDATE `DetailSOP`
  SET `status` = 'REVISI_DARI_EVALUATOR'
  WHERE `status` = 'REVISI_DARI_TIM_EVALUASI';

UPDATE `DetailSOP`
  SET `status` = 'DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI'
  WHERE `status` = 'DIVERIFIKASI_BIRO_ORGANISASI';

ALTER TABLE `DetailSOP`
  MODIFY `status` ENUM(
    'DRAFT',
    'SEDANG_DISUSUN',
    'SIAP_DIEVALUASI',
    'DIAJUKAN_EVALUASI',
    'SEDANG_DIEVALUASI',
    'REVISI_DARI_EVALUATOR',
    'SIAP_DIVERIFIKASI',
    'DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI',
    'BERLAKU',
    'DIGANTIKAN',
    'DICABUT'
  ) NOT NULL DEFAULT 'DRAFT';

-- 4) StatusPengajuanEvaluasi: tambahkan value baru dulu, migrasikan data, lalu hapus value lama.
ALTER TABLE `PengajuanEvaluasi`
  MODIFY `status` ENUM(
    'MENUNGGU_EVALUASI',
    'SEDANG_DIEVALUASI',
    'SELESAI_DIEVALUASI',
    'DIVERIFIKASI_BIRO',
    'DIVERIFIKASI_PJ_EVALUATOR',
    'DITANDATANGANI_KOORDINATOR',
    'DITANDATANGANI_PJ_PENYUSUN',
    'SELESAI'
  ) NOT NULL DEFAULT 'MENUNGGU_EVALUASI';

UPDATE `PengajuanEvaluasi`
  SET `status` = 'DIVERIFIKASI_PJ_EVALUATOR'
  WHERE `status` = 'DIVERIFIKASI_BIRO';

UPDATE `PengajuanEvaluasi`
  SET `status` = 'DITANDATANGANI_PJ_PENYUSUN'
  WHERE `status` = 'DITANDATANGANI_KOORDINATOR';

ALTER TABLE `PengajuanEvaluasi`
  MODIFY `status` ENUM(
    'MENUNGGU_EVALUASI',
    'SEDANG_DIEVALUASI',
    'SELESAI_DIEVALUASI',
    'DIVERIFIKASI_PJ_EVALUATOR',
    'DITANDATANGANI_PJ_PENYUSUN',
    'SELESAI'
  ) NOT NULL DEFAULT 'MENUNGGU_EVALUASI';

