-- Hapus MENUNGGU_EVALUASI: pengajuan baru langsung SEDANG_DIEVALUASI (terjadwal/mandiri sama).

UPDATE `PengajuanEvaluasi`
SET
  `status` = 'SEDANG_DIEVALUASI',
  `tanggalEvaluasi` = COALESCE(`tanggalEvaluasi`, `tanggalPermintaan`, `createdAt`)
WHERE `status` = 'MENUNGGU_EVALUASI';

ALTER TABLE `PengajuanEvaluasi`
  MODIFY `status` ENUM(
    'SEDANG_DIEVALUASI',
    'SELESAI_DIEVALUASI',
    'DIVERIFIKASI_PJ_EVALUATOR',
    'DITANDATANGANI_PJ_PENYUSUN',
    'SELESAI'
  ) NOT NULL DEFAULT 'SEDANG_DIEVALUASI';
