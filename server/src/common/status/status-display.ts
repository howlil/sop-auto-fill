import {
  HasilEvaluasi,
  StatusTindakLanjut,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../generated/prisma';

export interface StatusDisplay {
  readonly value: string;
  readonly label: string;
}

export const HASIL_EVALUASI_BELUM_DINILAI = 'BELUM_DINILAI' as const;

export type TampilanAlurEvaluasi = 'perlu_evaluasi' | 'sedang_dievaluasi' | 'selesai_pengajuan_ini';

const SOP_STATUS_LABELS: Record<StatusSOP, string> = {
  [StatusSOP.DRAFT]: 'Draft',
  [StatusSOP.SEDANG_DISUSUN]: 'Sedang disusun',
  [StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI]: 'Menunggu pengajuan evaluasi',
  [StatusSOP.DIAJUKAN_EVALUASI]: 'Diajukan evaluasi',
  [StatusSOP.SEDANG_DIEVALUASI]: 'Dalam penilaian',
  [StatusSOP.REVISI_DARI_EVALUATOR]: 'Perlu revisi',
  [StatusSOP.DITOLAK_EVALUATOR]: 'Ditolak evaluator',
  [StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR]: 'Menunggu TTD PJ Evaluator',
  [StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI]: 'Menunggu pengesahan Kepala OPD',
  [StatusSOP.BERLAKU]: 'Berlaku',
  [StatusSOP.DIGANTIKAN]: 'Digantikan',
  [StatusSOP.DICABUT]: 'Dicabut',
};

const PENGAJUAN_STATUS_LABELS: Record<StatusPengajuanEvaluasi, string> = {
  [StatusPengajuanEvaluasi.SEDANG_DIEVALUASI]: 'Sedang dinilai tim',
  [StatusPengajuanEvaluasi.DITOLAK]: 'Ditolak evaluator',
  [StatusPengajuanEvaluasi.SELESAI_DIEVALUASI]: 'Menunggu tanda tangan BA',
  [StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR]: 'BA ditandatangani PJ Evaluator',
  [StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN]: 'Menunggu pengesahan Kepala OPD',
  [StatusPengajuanEvaluasi.SELESAI]: 'Pengajuan evaluasi selesai',
};

const HASIL_EVALUASI_LABELS: Record<HasilEvaluasi, string> = {
  [HasilEvaluasi.SESUAI]: 'Sesuai',
  [HasilEvaluasi.PERLU_PERBAIKAN]: 'Perlu perbaikan',
  [HasilEvaluasi.DITOLAK]: 'Ditolak',
};

const TAMPILAN_ALUR_LABELS: Record<TampilanAlurEvaluasi, string> = {
  perlu_evaluasi: 'Perlu evaluasi',
  sedang_dievaluasi: 'Sedang dievaluasi',
  selesai_pengajuan_ini: 'Penilaian selesai (pengajuan ini)',
};

const STATUS_TINDAK_LANJUT_LABELS: Record<StatusTindakLanjut, string> = {
  [StatusTindakLanjut.TERBUKA]: 'Menunggu tindak lanjut OPD',
  [StatusTindakLanjut.SELESAI]: 'Siap dinilai ulang',
};

function resolveEnumLabel<T extends string>(
  value: T | string | null | undefined,
  labels: Record<string, string>,
  fallbackLabel: string,
): StatusDisplay {
  const key = value === null || value === undefined ? '' : String(value);
  if (key === '') {
    return { value: '', label: fallbackLabel };
  }
  const label = labels[key];
  return { value: key, label: label ?? fallbackLabel };
}

/** Status dokumen SOP (enum StatusSOP). */
export function displayStatusSop(status: StatusSOP | string): StatusDisplay {
  return resolveEnumLabel(status, SOP_STATUS_LABELS, 'Status tidak dikenal');
}

/** Status pengajuan evaluasi. */
export function displayStatusPengajuan(status: StatusPengajuanEvaluasi | string): StatusDisplay {
  return resolveEnumLabel(
    status,
    PENGAJUAN_STATUS_LABELS,
    'Status pengajuan evaluasi tidak dikenal',
  );
}

/** Hasil penilaian per dokumen; null → BELUM_DINILAI (turunan API). */
export function displayHasilEvaluasi(
  hasil: HasilEvaluasi | string | null | undefined,
): StatusDisplay {
  if (hasil === null || hasil === undefined) {
    return {
      value: HASIL_EVALUASI_BELUM_DINILAI,
      label: 'Belum dinilai',
    };
  }
  const key = String(hasil);
  const label = HASIL_EVALUASI_LABELS[key as HasilEvaluasi];
  return {
    value: key,
    label: label ?? 'Hasil tidak dikenal',
  };
}

/** Alur tampilan workspace evaluator (dihitung server). */
export function displayTampilanAlur(alur: TampilanAlurEvaluasi | string): StatusDisplay {
  return resolveEnumLabel(alur, TAMPILAN_ALUR_LABELS, 'Alur tidak dikenal');
}

/** Status tindak lanjut umpan balik evaluasi pada baris NilaiEvaluasi. */
export function displayStatusTindakLanjut(
  status: StatusTindakLanjut | string | null | undefined,
): StatusDisplay | null {
  if (status === null || status === undefined) {
    return null;
  }
  return resolveEnumLabel(
    status,
    STATUS_TINDAK_LANJUT_LABELS,
    'Status tindak lanjut tidak dikenal',
  );
}
