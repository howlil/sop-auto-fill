-- Rename BagianSOP.KOMENTAR -> UMPAN_BALIK; sinkron indeks lampiran & NilaiEvaluasi.

-- ---------------------------------------------------------------------------
-- 1) BagianSOP: tambah UMPAN_BALIK, migrasi data, hapus KOMENTAR
-- ---------------------------------------------------------------------------
ALTER TABLE `LogEditSOP`
  MODIFY `bagian` ENUM('HEADER', 'LANGKAH', 'STATUS', 'KOMENTAR', 'UMPAN_BALIK', 'EVALUASI') NOT NULL DEFAULT 'HEADER';

UPDATE `LogEditSOP`
SET `bagian` = 'UMPAN_BALIK'
WHERE `bagian` = 'KOMENTAR';

ALTER TABLE `LogEditSOP`
  MODIFY `bagian` ENUM('HEADER', 'LANGKAH', 'STATUS', 'UMPAN_BALIK', 'EVALUASI') NOT NULL DEFAULT 'HEADER';

-- ---------------------------------------------------------------------------
-- 2) Indeks lampiran: cukup detailSopId (bukan riwayat berdasarkan createdAt)
-- Buat indeks FK baru dulu agar DROP indeks lama tidak gagal (MySQL 1553).
-- ---------------------------------------------------------------------------
CREATE INDEX `LampiranPeringatan_detailSopId_idx` ON `LampiranPeringatan`(`detailSopId`);
DROP INDEX `LampiranPeringatan_detailSopId_createdAt_idx` ON `LampiranPeringatan`;

CREATE INDEX `LampiranKualifikasiPelaksanaan_detailSopId_idx` ON `LampiranKualifikasiPelaksanaan`(`detailSopId`);
DROP INDEX `LampiranKualifikasiPelaksanaan_detailSopId_createdAt_idx` ON `LampiranKualifikasiPelaksanaan`;

CREATE INDEX `LampiranPeralatanPerlengkapan_detailSopId_idx` ON `LampiranPeralatanPerlengkapan`(`detailSopId`);
DROP INDEX `LampiranPeralatanPerlengkapan_detailSopId_createdAt_idx` ON `LampiranPeralatanPerlengkapan`;

CREATE INDEX `LampiranPencatatanPendataan_detailSopId_idx` ON `LampiranPencatatanPendataan`(`detailSopId`);
DROP INDEX `LampiranPencatatanPendataan_detailSopId_createdAt_idx` ON `LampiranPencatatanPendataan`;
