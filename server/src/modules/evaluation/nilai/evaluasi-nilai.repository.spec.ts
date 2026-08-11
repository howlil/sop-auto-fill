import type { PrismaService } from '../../../common/prisma/prisma.service';
import { HasilEvaluasi, StatusPengajuanEvaluasi } from '../../../generated/prisma';
import { EvaluasiNilaiRepository } from './evaluasi-nilai.repository';

describe('Pengujian EvaluasiNilaiRepository', () => {
  const prismaMock = {
    $transaction: jest.fn(),
    nilaiEvaluasi: {
      findFirst: jest.fn(),
    },
    detailSOP: {
      findUnique: jest.fn(),
    },
  };
  let repo: EvaluasiNilaiRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new EvaluasiNilaiRepository(prismaMock as unknown as PrismaService);
  });

  it('seharusnya menjalankan callback dalam transaksi Prisma', async () => {
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => unknown) =>
      callback('tx'),
    );

    const actual = await repo.runTransaction(async (tx) => `result-${String(tx)}`);

    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(actual).toBe('result-tx');
  });

  it('seharusnya mencari nilai revisi aktif terbaru untuk detail SOP', async () => {
    await repo.findNilaiRevisiAktifForDetail('d1');

    expect(prismaMock.nilaiEvaluasi.findFirst).toHaveBeenCalledWith({
      where: {
        detailSopId: 'd1',
        hasil: HasilEvaluasi.PERLU_PERBAIKAN,
        pengajuanEvaluasi: {
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        pengajuanEvaluasiId: true,
        detailSopId: true,
        hasil: true,
        statusTindakLanjut: true,
      },
    });
  });

  it('seharusnya mencari umpan balik aktif untuk detail SOP dan OPD', async () => {
    await repo.findUmpanBalikForDetail('d1', 'opd-1');

    expect(prismaMock.nilaiEvaluasi.findFirst).toHaveBeenCalledWith({
      where: {
        detailSopId: 'd1',
        OR: [
          {
            hasil: HasilEvaluasi.PERLU_PERBAIKAN,
            pengajuanEvaluasi: {
              opdId: 'opd-1',
              status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            },
          },
          {
            hasil: HasilEvaluasi.DITOLAK,
            pengajuanEvaluasi: {
              opdId: 'opd-1',
              status: StatusPengajuanEvaluasi.DITOLAK,
            },
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        pengajuanEvaluasiId: true,
        detailSopId: true,
        hasil: true,
        catatan: true,
        statusTindakLanjut: true,
        ditindaklanjutiPada: true,
        version: true,
        dinilaiOleh: { select: { penggunaId: true, nama: true } },
        ditindaklanjutiOleh: { select: { penggunaId: true, nama: true } },
        pengajuanEvaluasi: { select: { status: true } },
      },
    });
  });

  it('seharusnya mengembalikan OPD id dari detail SOP', async () => {
    prismaMock.detailSOP.findUnique.mockResolvedValueOnce({ sop: { opdId: 'opd-1' } });

    const actual = await repo.findOpdIdByDetailSopId('d1');

    expect(prismaMock.detailSOP.findUnique).toHaveBeenCalledWith({
      where: { detailSopId: 'd1' },
      select: { sop: { select: { opdId: true } } },
    });
    expect(actual).toBe('opd-1');
  });

  it('seharusnya mengembalikan null ketika detail SOP tidak ditemukan saat mencari OPD id', async () => {
    prismaMock.detailSOP.findUnique.mockResolvedValueOnce(null);

    await expect(repo.findOpdIdByDetailSopId('missing')).resolves.toBeNull();
  });
});
