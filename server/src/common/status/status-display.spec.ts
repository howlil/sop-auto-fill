import {
  HasilEvaluasi,
  StatusPengajuanEvaluasi,
  StatusSOP,
  StatusTindakLanjut,
} from '../../generated/prisma';
import {
  displayHasilEvaluasi,
  displayStatusPengajuan,
  displayStatusSop,
  displayTampilanAlur,
  displayStatusTindakLanjut,
  HASIL_EVALUASI_BELUM_DINILAI,
} from './status-display';

describe('Pengujian displayStatusSop', () => {
  it('seharusnya menyediakan label untuk setiap enum StatusSOP', () => {
    for (const status of Object.values(StatusSOP)) {
      const actual = displayStatusSop(status);
      expect(actual.value).toBe(status);
      expect(actual.label.length).toBeGreaterThan(0);
    }
  });
  it('seharusnya menangani input yang tidak dikenal pada displayStatusSop dengan label fallback (False Case)', () => {
    const actual = displayStatusSop('STATUS_GAIB');
    expect(actual.label).toBe('Status tidak dikenal');
    expect(actual.value).toBe('STATUS_GAIB');
  });

  it('seharusnya memetakan status SOP rename ke label baru', () => {
    expect(displayStatusSop(StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI).label).toBe(
      'Menunggu pengajuan evaluasi',
    );
    expect(displayStatusSop(StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR).label).toBe(
      'Menunggu TTD PJ Evaluator',
    );
  });

  it('seharusnya menangani input kosong / null dengan string fallback (Edge Case)', () => {
    const actual = displayStatusSop(null as any);
    expect(actual.label).toBe('Status tidak dikenal');
    expect(actual.value).toBe('');
  });
});

describe('Pengujian displayStatusPengajuan', () => {
  it('seharusnya menyediakan label untuk setiap enum StatusPengajuanEvaluasi', () => {
    for (const status of Object.values(StatusPengajuanEvaluasi)) {
      const actual = displayStatusPengajuan(status);
      expect(actual.value).toBe(status);
      expect(actual.label.length).toBeGreaterThan(0);
    }
  });

  it('seharusnya memetakan DITANDATANGANI_PJ_EVALUATOR menjadi BA ditandatangani PJ Evaluator', () => {
    expect(displayStatusPengajuan(StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR).label).toBe(
      'BA ditandatangani PJ Evaluator',
    );
  });

  it('seharusnya memetakan DITANDATANGANI_PJ_PENYUSUN menjadi menunggu pengesahan Kepala OPD', () => {
    expect(displayStatusPengajuan(StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN).label).toBe(
      'Menunggu pengesahan Kepala OPD',
    );
  });
});

describe('Pengujian displayHasilEvaluasi', () => {
  it('seharusnya mengembalikan BELUM_DINILAI ketika hasil bernilai null', () => {
    const actual = displayHasilEvaluasi(null);
    expect(actual.value).toBe(HASIL_EVALUASI_BELUM_DINILAI);
    expect(actual.label).toBe('Belum dinilai');
  });

  it('seharusnya memetakan SESUAI, PERLU_PERBAIKAN, dan DITOLAK', () => {
    expect(displayHasilEvaluasi(HasilEvaluasi.SESUAI).label).toBe('Sesuai');
    expect(displayHasilEvaluasi(HasilEvaluasi.PERLU_PERBAIKAN).label).toBe('Perlu perbaikan');
    expect(displayHasilEvaluasi(HasilEvaluasi.DITOLAK).label).toBe('Ditolak');
  });
});

describe('Pengujian displayTampilanAlur', () => {
  it('seharusnya menyediakan label untuk semua nilai alur', () => {
    const values = ['perlu_evaluasi', 'sedang_dievaluasi', 'selesai_pengajuan_ini'] as const;
    for (const alur of values) {
      const actual = displayTampilanAlur(alur);
      expect(actual.value).toBe(alur);
      expect(actual.label.length).toBeGreaterThan(0);
    }
  });
});

describe('Pengujian displayStatusTindakLanjut', () => {
  it('seharusnya mengembalikan null ketika input bernilai null atau undefined (Edge Case)', () => {
    expect(displayStatusTindakLanjut(null)).toBeNull();
    expect(displayStatusTindakLanjut(undefined)).toBeNull();
  });

  it('seharusnya memetakan nilai Enum yang valid', () => {
    expect(displayStatusTindakLanjut(StatusTindakLanjut.TERBUKA)!.label).toBe(
      'Menunggu tindak lanjut OPD',
    );

    expect(displayStatusTindakLanjut(StatusTindakLanjut.SELESAI)!.label).toBe('Siap dinilai ulang');
  });

  it('seharusnya menggunakan label fallback ketika nilai tidak dikenal (False Case)', () => {
    expect(displayStatusTindakLanjut('TIDAK_JELAS')!.label).toBe(
      'Status tindak lanjut tidak dikenal',
    );
  });
});
