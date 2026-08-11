import { StatusPengajuanEvaluasi } from '../../../generated/prisma';

/** Status pengajuan yang masih berada dalam alur kerja lintas jobdesk sampai sebelum finalisasi. */
export const STATUS_PENGAJUAN_AKTIF_LINTAS_JOBDESK: readonly StatusPengajuanEvaluasi[] = [
  StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
  StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
  StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
  StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
] as const;
