-- Audit perubahan status tindak lanjut pada setiap log nilai evaluasi.
ALTER TABLE `LogNilaiEvaluasi`
    ADD COLUMN `statusTindakLanjutSebelum` ENUM('TERBUKA', 'SELESAI') NULL,
    ADD COLUMN `statusTindakLanjutSesudah` ENUM('TERBUKA', 'SELESAI') NULL,
    ADD COLUMN `ditindaklanjutiOlehId` VARCHAR(191) NULL,
    ADD COLUMN `ditindaklanjutiPada` DATETIME(3) NULL;
