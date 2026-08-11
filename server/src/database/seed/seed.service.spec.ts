import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SeedService } from './seed.service';

type CleanupSeedService = {
  cleanupLegacyWorkflowSeedData(tx: unknown): Promise<void>;
};

describe('SeedService cleanup legacy workflow data', () => {
  it('seharusnya memutus self-FK revisi dan langkah sebelum menghapus SOP legacy seed', async () => {
    const calls: string[] = [];
    const record = (name: string) =>
      jest.fn(async () => {
        calls.push(name);
        return { count: 1 };
      });

    const tx = {
      detailSOP: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ detailSopId: 'detail-v1', sopId: 'sop-seed' }])
          .mockResolvedValueOnce([{ detailSopId: 'detail-v1' }, { detailSopId: 'detail-v2' }]),
        updateMany: record('detailSOP.updateMany'),
      },
      pengajuanEvaluasi: {
        findMany: jest.fn(async () => [{ pengajuanEvaluasiId: 'pengajuan-seed' }]),
        deleteMany: record('pengajuanEvaluasi.deleteMany'),
      },
      sOP: {
        findMany: jest.fn(async () => [{ sopId: 'sop-seed' }]),
        deleteMany: record('sOP.deleteMany'),
      },
      dokumenTte: {
        findMany: jest.fn(async () => [{ dokumenTteId: 'dokumen-seed' }]),
        deleteMany: record('dokumenTte.deleteMany'),
      },
      riwayatTandaTangan: {
        deleteMany: record('riwayatTandaTangan.deleteMany'),
      },
      logNilaiEvaluasi: {
        deleteMany: record('logNilaiEvaluasi.deleteMany'),
      },
      nilaiEvaluasi: {
        deleteMany: record('nilaiEvaluasi.deleteMany'),
      },
      logEditSOP: {
        deleteMany: record('logEditSOP.deleteMany'),
      },
      langkahSOP: {
        findMany: jest.fn(async () => [
          { langkahSopId: 'langkah-1' },
          { langkahSopId: 'langkah-2' },
        ]),
        updateMany: record('langkahSOP.updateMany'),
      },
    };

    const service = new SeedService(
      {} as PrismaService,
      {} as ConfigService,
    ) as unknown as CleanupSeedService;

    await service.cleanupLegacyWorkflowSeedData(tx);

    expect(tx.detailSOP.findMany).toHaveBeenNthCalledWith(2, {
      where: { sopId: { in: ['sop-seed'] } },
      select: { detailSopId: true },
    });

    const revisiUpdate = (tx.detailSOP.updateMany as jest.Mock).mock.calls[0][0];
    expect(revisiUpdate).toEqual({
      where: { revisiDariDetailSopId: { in: ['detail-v1', 'detail-v2'] } },
      data: { revisiDariDetailSopId: null },
    });

    const langkahUpdate = (tx.langkahSOP.updateMany as jest.Mock).mock.calls[0][0];
    expect(langkahUpdate).toEqual({
      where: {
        OR: [
          { detailSopId: { in: ['detail-v1', 'detail-v2'] } },
          { langkahSelanjutnyaYaId: { in: ['langkah-1', 'langkah-2'] } },
          { langkahSelanjutnyaTidakId: { in: ['langkah-1', 'langkah-2'] } },
        ],
      },
      data: { langkahSelanjutnyaYaId: null, langkahSelanjutnyaTidakId: null },
    });

    expect(calls.indexOf('detailSOP.updateMany')).toBeLessThan(calls.indexOf('sOP.deleteMany'));
    expect(calls.indexOf('langkahSOP.updateMany')).toBeLessThan(calls.indexOf('sOP.deleteMany'));
  });
});
