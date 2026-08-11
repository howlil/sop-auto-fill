import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PeranPengguna, StatusSOP } from '../../../generated/prisma';
import { assertAllowedSopStatusTransition } from './sop-status-policy';

describe('Pengujian kebijakan status SOP', () => {
  it('seharusnya melempar ConflictException ketika target sama dengan status saat ini', () => {
    expect(() =>
      assertAllowedSopStatusTransition({
        role: PeranPengguna.PENYUSUN,
        current: StatusSOP.DRAFT,
        target: StatusSOP.DRAFT,
      }),
    ).toThrow(ConflictException);
  });

  it('seharusnya mengizinkan penyusun draft menjadi menunggu pengajuan evaluasi', () => {
    expect(() =>
      assertAllowedSopStatusTransition({
        role: PeranPengguna.PENYUSUN,
        current: StatusSOP.DRAFT,
        target: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
      }),
    ).not.toThrow();
  });

  it('seharusnya menolak akses evaluator saat menandai menunggu pengajuan evaluasi', () => {
    expect(() =>
      assertAllowedSopStatusTransition({
        role: PeranPengguna.EVALUATOR,
        current: StatusSOP.DRAFT,
        target: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
      }),
    ).toThrow(ForbiddenException);
  });

  it('seharusnya mengizinkan PJ penyusun siap menjadi diajukan evaluasi', () => {
    expect(() =>
      assertAllowedSopStatusTransition({
        role: PeranPengguna.PJ_PENYUSUN,
        current: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
        target: StatusSOP.DIAJUKAN_EVALUASI,
      }),
    ).not.toThrow();
  });

  it('seharusnya menolak status berlaku melalui endpoint umum', () => {
    expect(() =>
      assertAllowedSopStatusTransition({
        role: PeranPengguna.KEPALA_OPD,
        current: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
        target: StatusSOP.BERLAKU,
      }),
    ).toThrow(ConflictException);
  });

  it('seharusnya mengizinkan kepala OPD cabut berlaku', () => {
    expect(() =>
      assertAllowedSopStatusTransition({
        role: PeranPengguna.KEPALA_OPD,
        current: StatusSOP.BERLAKU,
        target: StatusSOP.DICABUT,
      }),
    ).not.toThrow();
  });
});
