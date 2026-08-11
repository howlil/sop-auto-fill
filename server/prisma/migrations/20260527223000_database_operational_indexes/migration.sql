-- Index operasional untuk pola query daftar SOP, workspace evaluasi, arsip publik,
-- dan validasi relasi. Index ini sengaja mengikuti kolom WHERE + ORDER BY yang
-- paling sering muncul di repository server.

CREATE INDEX `Pengguna_opdId_peran_deletedAt_idx` ON `Pengguna`(`opdId`, `peran`, `deletedAt`);
CREATE INDEX `OPD_deletedAt_nama_idx` ON `OPD`(`deletedAt`, `nama`);
CREATE INDEX `RiwayatOpdPengguna_opdId_isAktif_idx` ON `RiwayatOpdPengguna`(`opdId`, `isAktif`);

CREATE INDEX `DetailSOP_sopId_status_versi_idx` ON `DetailSOP`(`sopId`, `status`, `versi`);
CREATE INDEX `DetailSOP_status_tanggalEfektif_idx` ON `DetailSOP`(`status`, `tanggalEfektif`);
CREATE INDEX `DasarHukum_peraturanId_idx` ON `DasarHukum`(`peraturanId`);
CREATE INDEX `SopTerkait_detailSopTerkaitId_idx` ON `SopTerkait`(`detailSopTerkaitId`);
CREATE INDEX `LangkahSOP_pelaksanaId_idx` ON `LangkahSOP`(`pelaksanaId`);
CREATE INDEX `LangkahSOP_langkahSelanjutnyaYaId_idx` ON `LangkahSOP`(`langkahSelanjutnyaYaId`);
CREATE INDEX `LangkahSOP_langkahSelanjutnyaTidakId_idx` ON `LangkahSOP`(`langkahSelanjutnyaTidakId`);
CREATE INDEX `Pelaksana_opdId_nama_idx` ON `Pelaksana`(`opdId`, `nama`);
CREATE INDEX `DetailSOPPelaksana_pelaksanaId_idx` ON `DetailSOPPelaksana`(`pelaksanaId`);

CREATE INDEX `PengajuanEvaluasi_opdId_status_updatedAt_idx` ON `PengajuanEvaluasi`(`opdId`, `status`, `updatedAt`);
CREATE INDEX `PengajuanEvaluasi_opd_status_selesai_idx` ON `PengajuanEvaluasi`(`opdId`, `status`, `tanggalDiselesaikan`, `updatedAt`);
CREATE INDEX `PengajuanEvaluasi_status_createdAt_idx` ON `PengajuanEvaluasi`(`status`, `createdAt`);
CREATE INDEX `NilaiEvaluasi_pengajuanEvaluasiId_hasil_idx` ON `NilaiEvaluasi`(`pengajuanEvaluasiId`, `hasil`);
CREATE INDEX `DokumenTte_jenisDokumen_createdAt_idx` ON `DokumenTte`(`jenisDokumen`, `createdAt`);
