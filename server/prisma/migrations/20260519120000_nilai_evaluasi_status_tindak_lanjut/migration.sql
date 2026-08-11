-- AlterTable: umpan balik evaluasi — status tindak lanjut penyusun (reuse StatusKomentar)
ALTER TABLE `NilaiEvaluasi`
    ADD COLUMN `statusTindakLanjut` ENUM('TERBUKA', 'SELESAI') NULL,
    ADD COLUMN `ditindaklanjutiPada` DATETIME(3) NULL,
    ADD COLUMN `ditindaklanjutiOlehId` VARCHAR(191) NULL;

ALTER TABLE `NilaiEvaluasi`
    ADD CONSTRAINT `NilaiEvaluasi_ditindaklanjutiOlehId_fkey`
    FOREIGN KEY (`ditindaklanjutiOlehId`) REFERENCES `Pengguna`(`penggunaId`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: baris perlu perbaikan menunggu tindak lanjut
UPDATE `NilaiEvaluasi`
SET `statusTindakLanjut` = 'TERBUKA'
WHERE `hasil` = 'PERLU_PERBAIKAN' AND `statusTindakLanjut` IS NULL;
