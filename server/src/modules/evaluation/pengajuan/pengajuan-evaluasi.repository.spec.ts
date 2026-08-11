import { StatusPengajuanEvaluasi, StatusSOP } from '../../../generated/prisma';
import { PengajuanEvaluasiRepository } from './pengajuan-evaluasi.repository';

describe('Pengujian PengajuanEvaluasiRepository.buildWhere dari query', () => {
  const repo = new PengajuanEvaluasiRepository(null as never);

  it('seharusnya menggunakan status In ketika non kosong dan mengabaikan tunggal status', () => {
    const actual = repo.buildWhereFromQuery({
      status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
      statusIn: [
        StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
        StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
      ],
    });
    expect(actual).toEqual({
      AND: [
        {
          status: {
            in: [
              StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
              StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
            ],
          },
        },
      ],
    });
  });

  it('seharusnya memakai status tunggal ketika daftar status kosong', () => {
    const actual = repo.buildWhereFromQuery({
      statusIn: [],
      status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
    });
    expect(actual).toEqual({
      AND: [{ status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR }],
    });
  });
});

describe('Pengujian repairPengesahanKepalaOpdStatusJikaDokumenSudahSigned', () => {
  it('seharusnya menyelaraskan status pengajuan dan detail SOP jika dokumen resmi sudah signed dan published', async () => {
    const signedAt = new Date('2026-06-04T08:37:30.794Z');
    const tx = {
      detailSOP: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      pengajuanEvaluasi: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      $executeRaw: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      pengajuanEvaluasi: {
        findUnique: jest.fn().mockResolvedValue({
          pengajuanEvaluasiId: 'peng-1',
          status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
          opdId: 'opd-1',
          nilaiEvaluasi: [
            {
              detailSop: {
                detailSopId: 'detail-1',
                sopId: 'sop-1',
                status: StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI,
                tanggalEfektif: null,
                sop: { opdId: 'opd-1' },
                dokumenTte: [
                  {
                    dokumenTteId: 'doc-1',
                    pdfPath: 'opd/sop/detail.pdf',
                    pdfSha256: 'sha256',
                    pdfStatus: 'PUBLISHED',
                    riwayatTandaTangan: [
                      {
                        userId: 'kepala-1',
                        ditandatanganiPada: signedAt,
                      },
                    ],
                  },
                ],
              },
            },
          ],
        }),
      },
      $transaction: jest.fn((callback: (transactionClient: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PengajuanEvaluasiRepository(prisma as never);

    const repaired =
      await repository.repairPengesahanKepalaOpdStatusJikaDokumenSudahSigned('peng-1');

    expect(repaired).toBe(true);
    expect(tx.detailSOP.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { detailSopId: 'detail-1' },
        data: expect.objectContaining({
          status: StatusSOP.BERLAKU,
          terakhirDieditOlehId: 'kepala-1',
        }),
      }),
    );
    expect(tx.pengajuanEvaluasi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pengajuanEvaluasiId: 'peng-1' },
        data: expect.objectContaining({
          status: StatusPengajuanEvaluasi.SELESAI,
        }),
      }),
    );
  });
});
