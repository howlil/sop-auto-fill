import { StatusPengajuanEvaluasi, StatusSOP } from '../../generated/prisma';
import { mapStatusSopUntukPengajuan } from './seed-status.util';

describe('Pengujian mapStatusSopUntukPengajuan', () => {
  it('seharusnya memetakan SEDANG_DIEVALUASI tetap menjadi SEDANG_DIEVALUASI', () => {
    expect(mapStatusSopUntukPengajuan(StatusPengajuanEvaluasi.SEDANG_DIEVALUASI)).toBe(
      StatusSOP.SEDANG_DIEVALUASI,
    );
  });

  it('seharusnya memetakan DITOLAK menjadi DITOLAK_EVALUATOR', () => {
    expect(mapStatusSopUntukPengajuan(StatusPengajuanEvaluasi.DITOLAK)).toBe(
      StatusSOP.DITOLAK_EVALUATOR,
    );
  });

  it('seharusnya memetakan SELESAI_DIEVALUASI menjadi MENUNGGU_TTD_PJ_EVALUATOR', () => {
    expect(mapStatusSopUntukPengajuan(StatusPengajuanEvaluasi.SELESAI_DIEVALUASI)).toBe(
      StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR,
    );
  });

  it('seharusnya memetakan DITANDATANGANI_PJ_EVALUATOR menjadi MENUNGGU_TTD_PJ_EVALUATOR', () => {
    expect(mapStatusSopUntukPengajuan(StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR)).toBe(
      StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR,
    );
  });

  it('seharusnya memetakan DITANDATANGANI_PJ_PENYUSUN menjadi DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI', () => {
    expect(mapStatusSopUntukPengajuan(StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN)).toBe(
      StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI,
    );
  });

  it('seharusnya memetakan SELESAI menjadi BERLAKU', () => {
    expect(mapStatusSopUntukPengajuan(StatusPengajuanEvaluasi.SELESAI)).toBe(StatusSOP.BERLAKU);
  });
});
