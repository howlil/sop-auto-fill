import { BadRequestException } from '@nestjs/common';
import { HasilEvaluasi, StatusTindakLanjut } from '../../../generated/prisma';
import { assertBolehKirimUlangSetelahRevisi } from './evaluasi-revisi.policy';

describe('Pengujian kebijakan revisi evaluasi', () => {
  it('seharusnya lolos ketika nilai tidak ada', () => {
    expect(() => assertBolehKirimUlangSetelahRevisi(null)).not.toThrow();
  });

  it('seharusnya lolos ketika status masih terbuka', () => {
    expect(() =>
      assertBolehKirimUlangSetelahRevisi({
        pengajuanEvaluasiId: 'p1',
        detailSopId: 'd1',
        hasil: HasilEvaluasi.PERLU_PERBAIKAN,
        statusTindakLanjut: StatusTindakLanjut.TERBUKA,
      }),
    ).not.toThrow();
  });

  it('seharusnya melempar error ketika status tindak lanjut masih kosong', () => {
    expect(() =>
      assertBolehKirimUlangSetelahRevisi({
        pengajuanEvaluasiId: 'p1',
        detailSopId: 'd1',
        hasil: HasilEvaluasi.PERLU_PERBAIKAN,
        statusTindakLanjut: null,
      }),
    ).toThrow(BadRequestException);
  });

  it('seharusnya lolos ketika status selesai', () => {
    expect(() =>
      assertBolehKirimUlangSetelahRevisi({
        pengajuanEvaluasiId: 'p1',
        detailSopId: 'd1',
        hasil: HasilEvaluasi.PERLU_PERBAIKAN,
        statusTindakLanjut: StatusTindakLanjut.SELESAI,
      }),
    ).not.toThrow();
  });
});
