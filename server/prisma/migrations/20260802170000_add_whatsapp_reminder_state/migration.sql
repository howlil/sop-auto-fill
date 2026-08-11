CREATE TABLE `PengingatWhatsApp` (
  `pengingatWhatsAppId` CHAR(36) NOT NULL,
  `pengajuanEvaluasiId` CHAR(36) NOT NULL,
  `penggunaId` CHAR(36) NOT NULL,
  `jenis` ENUM(
    'EVALUASI_SOP',
    'TTD_BA_PJ_EVALUATOR',
    'TTD_BA_PJ_PENYUSUN',
    'TTD_SOP_KEPALA_OPD'
  ) NOT NULL,
  `nomorTujuan` VARCHAR(20) NOT NULL,
  `nextSendAt` DATETIME(3) NOT NULL,
  `lastSentAt` DATETIME(3) NULL,
  `consecutiveFailures` INTEGER NOT NULL DEFAULT 0,
  `lastErrorKind` VARCHAR(64) NULL,
  `lockedUntil` DATETIME(3) NULL,
  `lockToken` CHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `PengingatWhatsApp_pengajuan_pengguna_jenis_key`(
    `pengajuanEvaluasiId`,
    `penggunaId`,
    `jenis`
  ),
  INDEX `PengingatWhatsApp_due_lock_idx`(`nextSendAt`, `lockedUntil`),
  INDEX `PengingatWhatsApp_pengajuan_idx`(`pengajuanEvaluasiId`),
  INDEX `PengingatWhatsApp_pengguna_idx`(`penggunaId`),
  PRIMARY KEY (`pengingatWhatsAppId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PengingatWhatsApp`
  ADD CONSTRAINT `PengingatWhatsApp_pengajuanEvaluasiId_fkey`
  FOREIGN KEY (`pengajuanEvaluasiId`) REFERENCES `PengajuanEvaluasi`(`pengajuanEvaluasiId`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PengingatWhatsApp_penggunaId_fkey`
  FOREIGN KEY (`penggunaId`) REFERENCES `Pengguna`(`penggunaId`)
  ON DELETE CASCADE ON UPDATE CASCADE;
