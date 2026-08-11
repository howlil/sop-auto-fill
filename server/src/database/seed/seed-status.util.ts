import { StatusPengajuanEvaluasi, StatusSOP } from '../../generated/prisma';

/**
 * Memetakan status pengajuan evaluasi ke status DetailSOP anggota batch (seed sync).
 * Selaras `EvaluasiNilaiService.selesai` dan `TteRepository` (BERLAKU hanya setelah TTE Kepala OPD).
 */
export function mapStatusSopUntukPengajuan(statusPengajuan: StatusPengajuanEvaluasi): StatusSOP {
  switch (statusPengajuan) {
    case StatusPengajuanEvaluasi.SEDANG_DIEVALUASI:
      return StatusSOP.SEDANG_DIEVALUASI;
    case StatusPengajuanEvaluasi.DITOLAK:
      return StatusSOP.DITOLAK_EVALUATOR;
    case StatusPengajuanEvaluasi.SELESAI_DIEVALUASI:
      return StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR;
    case StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR:
      return StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR;
    case StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN:
      return StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI;
    case StatusPengajuanEvaluasi.SELESAI:
      return StatusSOP.BERLAKU;
    default:
      return StatusSOP.SEDANG_DIEVALUASI;
  }
}
