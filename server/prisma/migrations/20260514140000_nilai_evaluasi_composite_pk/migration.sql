-- Normalisasi: PK komposit (pengajuanEvaluasiId, detailSopId), hapus surrogate nilaiEvaluasiId.
ALTER TABLE `NilaiEvaluasi` DROP PRIMARY KEY;
-- MySQL memakai index unique lama sebagai backing index untuk FK `pengajuanEvaluasiId`.
-- Sediakan index pengganti dulu sebelum unique index lama dihapus.
CREATE INDEX `NilaiEvaluasi_pengajuanEvaluasiId_idx` ON `NilaiEvaluasi`(`pengajuanEvaluasiId`);
ALTER TABLE `NilaiEvaluasi` DROP INDEX `NilaiEvaluasi_pengajuanEvaluasiId_detailSopId_key`;
ALTER TABLE `NilaiEvaluasi` DROP COLUMN `nilaiEvaluasiId`;
ALTER TABLE `NilaiEvaluasi` ADD PRIMARY KEY (`pengajuanEvaluasiId`, `detailSopId`);
