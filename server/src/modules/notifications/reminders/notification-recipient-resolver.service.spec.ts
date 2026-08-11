import { PeranPengguna, StatusPengajuanEvaluasi } from '../../../generated/prisma';
import { NotificationRecipientResolverService } from './notification-recipient-resolver.service';
import type { ActionablePengajuan, ActiveNotificationRecipient } from './notification-reminder.types';

const basePengajuan: ActionablePengajuan = {
  pengajuanEvaluasiId: 'pengajuan-1',
  opdId: 'opd-1',
  opdNama: 'Dinas Kesehatan',
  nomorBA: 'BA-001',
  status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
  jumlahSop: 2,
};

function recipient(
  penggunaId: string,
  peran: PeranPengguna,
  opdId = 'opd-1',
): ActiveNotificationRecipient {
  return { penggunaId, peran, opdId, email: `${penggunaId}@example.test`, nama: penggunaId, nohp: `628123456789` };
}

describe('NotificationRecipientResolverService', () => {
  it('mengirim evaluasi ke seluruh evaluator aktif dan bukan peran lain', () => {
    const service = new NotificationRecipientResolverService();
    const actual = service.resolve(basePengajuan, [
      recipient('eval-1', PeranPengguna.EVALUATOR),
      recipient('eval-2', PeranPengguna.EVALUATOR),
      recipient('pj', PeranPengguna.PJ_EVALUATOR),
    ]);
    expect(actual.map((row) => row.penggunaId)).toEqual(['eval-1', 'eval-2']);
  });

  it('menggunakan email penerima sebagai tujuan legacy reminder', () => {
    const service = new NotificationRecipientResolverService();
    const actual = service.resolve(basePengajuan, [
      recipient('eval-1', PeranPengguna.EVALUATOR),
      recipient('eval-2', PeranPengguna.EVALUATOR),
    ]);
    expect(actual.map((row) => row.destination)).toEqual([
      '628123456789',
      '628123456789',
    ]);
  });

  it('melakukan deduplikasi penerima berdasarkan pengguna', () => {
    const service = new NotificationRecipientResolverService();
    const actual = service.resolve(basePengajuan, [
      recipient('eval-1', PeranPengguna.EVALUATOR),
      recipient('eval-1', PeranPengguna.EVALUATOR),
    ]);
    expect(actual).toHaveLength(1);
    expect(actual[0]?.penggunaId).toBe('eval-1');
  });

  it('memilih tepat satu PJ Evaluator aktif untuk TTD BA', () => {
    const service = new NotificationRecipientResolverService();
    const actual = service.resolve(
      { ...basePengajuan, status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI },
      [recipient('pj', PeranPengguna.PJ_EVALUATOR)],
    );
    expect(actual).toHaveLength(1);
    expect(actual[0]?.penggunaId).toBe('pj');
  });

  it.each([0, 2])('fail closed jika jumlah PJ Evaluator = %i', (count) => {
    const service = new NotificationRecipientResolverService();
    const candidates = Array.from({ length: count }, (_, index) =>
      recipient(`pj-${index}`, PeranPengguna.PJ_EVALUATOR),
    );
    expect(
      service.resolve(
        { ...basePengajuan, status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI },
        candidates,
      ),
    ).toEqual([]);
  });

  it('memilih PJ Penyusun dari OPD pengajuan saja', () => {
    const service = new NotificationRecipientResolverService();
    const actual = service.resolve(
      { ...basePengajuan, status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR },
      [
        recipient('pj-opd-1', PeranPengguna.PJ_PENYUSUN, 'opd-1'),
        recipient('pj-opd-2', PeranPengguna.PJ_PENYUSUN, 'opd-2'),
      ],
    );
    expect(actual.map((row) => row.penggunaId)).toEqual(['pj-opd-1']);
  });

  it('memilih Kepala OPD dari OPD pengajuan saja', () => {
    const service = new NotificationRecipientResolverService();
    const actual = service.resolve(
      { ...basePengajuan, status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN },
      [recipient('kepala', PeranPengguna.KEPALA_OPD, 'opd-1')],
    );
    expect(actual.map((row) => row.penggunaId)).toEqual(['kepala']);
  });

});
