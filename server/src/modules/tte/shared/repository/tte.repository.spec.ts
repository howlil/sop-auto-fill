import { PeranPengguna, StatusPengajuanEvaluasi, StatusSOP } from '../../../../generated/prisma';
import { toWibDateOnly } from '../../../../common/date/wib-date.util';
import type { PrismaService } from '../../../../common/prisma/prisma.service';
import { TteRepository } from './tte.repository';

describe('Pengujian TteRepository', () => {
  const signedAt = new Date('2026-05-19T14:30:00+07:00');
  const expectedTanggalEfektif = toWibDateOnly(signedAt);

  function createRepository<T>(tx: T) {
    const prisma = {
      $transaction: jest.fn((callback: (transactionClient: T) => unknown) => callback(tx)),
    };
    return new TteRepository(prisma as unknown as PrismaService);
  }

  it('seharusnya menggunakan unique nomor dokumen per SOP ketika batch penandatanganan lebih dari satu SOP', async () => {
    const tx = {
      pengajuanEvaluasi: {
        findUnique: jest.fn().mockResolvedValue({
          pengajuanEvaluasiId: 'pengajuan-1',
          opdId: 'opd-1',
          status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
          nilaiEvaluasi: [
            {
              detailSop: {
                detailSopId: 'detail-1',
                sopId: 'sop-1',
                nomorSOP: 'SOP-001',
                status: StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI,
                sop: { opdId: 'opd-1', judul: 'SOP A' },
              },
            },
            {
              detailSop: {
                detailSopId: 'detail-2',
                sopId: 'sop-2',
                nomorSOP: 'SOP-002',
                status: StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI,
                sop: { opdId: 'opd-1', judul: 'SOP B' },
              },
            },
          ],
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      dokumenTte: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: { data: { detailSopId: string } }) => ({
          dokumenTteId: `dok-${data.detailSopId}`,
          detailSopId: data.detailSopId,
          pengajuanEvaluasiId: null,
        })),
        update: jest.fn().mockResolvedValue(undefined),
      },
      riwayatTandaTangan: {
        create: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      detailSOP: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const repo = createRepository(tx);

    await repo.transaksiTandaTanganiSemuaSopPengajuan({
      pengajuanEvaluasiId: 'pengajuan-1',
      userId: 'kepala-1',
      userOpdId: 'opd-1',
      peran: PeranPengguna.KEPALA_OPD,
      signedAt,
      hashDokumen: 'hash',
      nomorDokumen: 'DOC-BATCH',
      judulDokumen: 'Dokumen Batch',
    });

    expect(tx.detailSOP.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tanggalEfektif: expectedTanggalEfektif }),
      }),
    );
    expect(tx.dokumenTte.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nomorDokumen: 'DOC-BATCH-SOP-001' }),
      }),
    );
    expect(tx.dokumenTte.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nomorDokumen: 'DOC-BATCH-SOP-002' }),
      }),
    );
  });

  it('seharusnya sufiks nomor dokumen ketika batch penandatanganan tunggal SOP', async () => {
    const tx = {
      pengajuanEvaluasi: {
        findUnique: jest.fn().mockResolvedValue({
          pengajuanEvaluasiId: 'pengajuan-1',
          opdId: 'opd-1',
          status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
          nilaiEvaluasi: [
            {
              detailSop: {
                detailSopId: 'detail-1',
                sopId: 'sop-1',
                nomorSOP: 'SOP-DINKES-006-V1',
                status: StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI,
                sop: { opdId: 'opd-1', judul: 'Manajemen Farmasi Puskesmas' },
              },
            },
          ],
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      dokumenTte: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: { data: { detailSopId: string } }) => ({
          dokumenTteId: `dok-${data.detailSopId}`,
          detailSopId: data.detailSopId,
          pengajuanEvaluasiId: null,
        })),
        update: jest.fn().mockResolvedValue(undefined),
      },
      riwayatTandaTangan: {
        create: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      detailSOP: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const repo = createRepository(tx);

    await repo.transaksiTandaTanganiSemuaSopPengajuan({
      pengajuanEvaluasiId: 'pengajuan-1',
      userId: 'kepala-1',
      userOpdId: 'opd-1',
      peran: PeranPengguna.KEPALA_OPD,
      signedAt,
      hashDokumen: 'hash',
      nomorDokumen: 'BA-DINKES-2026-002',
      judulDokumen: 'Dokumen Batch',
    });

    expect(tx.detailSOP.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tanggalEfektif: expectedTanggalEfektif }),
      }),
    );
    expect(tx.dokumenTte.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nomorDokumen: 'BA-DINKES-2026-002-SOP-DINKES-006-V1',
        }),
      }),
    );
  });

  // --- COMPREHENSIVE TESTS (FALSE, WORST, EDGE CASES) ---

  describe('transaksiTandaTanganiBaEvaluator (Tambahan Kasus)', () => {
    it('seharusnya mengembalikan error NOT_FOUND jika pengajuan tidak ada', async () => {
      const tx = { pengajuanEvaluasi: { findUnique: jest.fn().mockResolvedValue(null) } };
      const repo = createRepository(tx);
      const res = await repo.transaksiTandaTanganiBaEvaluator({
        pengajuanEvaluasiId: 'x',
        userId: 'u',
        peran: PeranPengguna.PJ_EVALUATOR,
        hashDokumen: 'h',
        nomorDokumen: 'n',
        judulDokumen: 'j',
      });
      expect(res).toEqual({ error: 'NOT_FOUND' });
    });

    it('seharusnya mengembalikan error BAD_STATUS jika status pengajuan tidak SELESAI_DIEVALUASI', async () => {
      const tx = {
        pengajuanEvaluasi: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI }),
        },
      };
      const repo = createRepository(tx);
      const res = await repo.transaksiTandaTanganiBaEvaluator({
        pengajuanEvaluasiId: 'x',
        userId: 'u',
        peran: PeranPengguna.PJ_EVALUATOR,
        hashDokumen: 'h',
        nomorDokumen: 'n',
        judulDokumen: 'j',
      });
      expect(res).toEqual({
        error: 'BAD_STATUS',
        status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
      });
    });

    it('seharusnya mengembalikan error INVALID_DOC_PARENT jika dokumenTte berbagi parent (Edge Case)', async () => {
      const tx = {
        pengajuanEvaluasi: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI }),
        },
        dokumenTte: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ detailSopId: 'det-1', pengajuanEvaluasiId: 'x' }),
        }, // Keduanya ada -> invalid
      };
      const repo = createRepository(tx);
      const res = await repo.transaksiTandaTanganiBaEvaluator({
        pengajuanEvaluasiId: 'x',
        userId: 'u',
        peran: PeranPengguna.PJ_EVALUATOR,
        hashDokumen: 'h',
        nomorDokumen: 'n',
        judulDokumen: 'j',
      });
      expect(res).toEqual({ error: 'INVALID_DOC_PARENT' });
    });

    it('seharusnya mengembalikan error ALREADY_SIGNED jika peran sudah tanda tangan (Edge Case)', async () => {
      const tx = {
        pengajuanEvaluasi: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI }),
        },
        dokumenTte: {
          findUnique: jest.fn().mockResolvedValue({
            detailSopId: null,
            pengajuanEvaluasiId: 'x',
            dokumenTteId: 'doc-1',
          }),
          update: jest.fn(),
        },
        riwayatTandaTangan: { findUnique: jest.fn().mockResolvedValue({ ada: true }) }, // Riwayat sudah ada
      };
      const repo = createRepository(tx);
      const res = await repo.transaksiTandaTanganiBaEvaluator({
        pengajuanEvaluasiId: 'x',
        userId: 'u',
        peran: PeranPengguna.PJ_EVALUATOR,
        hashDokumen: 'h',
        nomorDokumen: 'n',
        judulDokumen: 'j',
      });
      expect(res).toEqual({ error: 'ALREADY_SIGNED' });
    });

    it('seharusnya berhasil menandatangani BA Evaluator (Success)', async () => {
      const tx = {
        pengajuanEvaluasi: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI }),
          update: jest.fn(),
        },
        dokumenTte: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ dokumenTteId: 'doc-new' }),
        },
        riwayatTandaTangan: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ berhasil: true }),
          create: jest.fn(),
        },
      };
      const repo = createRepository(tx);
      const res = await repo.transaksiTandaTanganiBaEvaluator({
        pengajuanEvaluasiId: 'x',
        userId: 'u',
        peran: PeranPengguna.PJ_EVALUATOR,
        hashDokumen: 'h',
        nomorDokumen: 'n',
        judulDokumen: 'j',
      });
      expect(res).toEqual({ ok: true, riwayat: { berhasil: true } });
      expect(tx.pengajuanEvaluasi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
          }),
        }),
      );
    });
  });

  describe('transaksiTandaTanganiBaPjPenyusun (Tambahan Kasus)', () => {
    it('seharusnya mengembalikan error FORBIDDEN_OPD jika opd pengguna berbeda', async () => {
      const tx = {
        pengajuanEvaluasi: { findUnique: jest.fn().mockResolvedValue({ opdId: 'opd-1' }) },
      };
      const repo = createRepository(tx);
      const res = await repo.transaksiTandaTanganiBaPjPenyusun({
        pengajuanEvaluasiId: 'x',
        userId: 'u',
        userOpdId: 'opd-beda',
        peran: PeranPengguna.PJ_PENYUSUN,
        hashDokumen: 'h',
        nomorDokumen: 'n',
        judulDokumen: 'j',
      });
      expect(res).toEqual({ error: 'FORBIDDEN_OPD' });
    });

    it('seharusnya mengembalikan error DOC_MISMATCH jika dokumenTte milik pengajuan lain (Worst Case)', async () => {
      const tx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            opdId: 'opd-1',
            status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
          }),
        },
        dokumenTte: {
          findUnique: jest.fn().mockResolvedValue({
            detailSopId: null,
            pengajuanEvaluasiId: 'beda',
            dokumenTteId: 'doc-1',
          }),
        },
      };
      const repo = createRepository(tx);
      const res = await repo.transaksiTandaTanganiBaPjPenyusun({
        pengajuanEvaluasiId: 'x',
        userId: 'u',
        userOpdId: 'opd-1',
        peran: PeranPengguna.PJ_PENYUSUN,
        hashDokumen: 'h',
        nomorDokumen: 'n',
        judulDokumen: 'j',
      });
      expect(res).toEqual({ error: 'DOC_MISMATCH' });
    });

    it('seharusnya mengembalikan error SOP_STATUS_DRIFT jika jumlah SOP yang diupdate tidak cocok (Edge Case)', async () => {
      const tx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            opdId: 'opd-1',
            status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
            nilaiEvaluasi: [{ detailSopId: 'd1' }, { detailSopId: 'd2' }],
          }),
        },
        dokumenTte: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            detailSopId: null,
            pengajuanEvaluasiId: 'x',
            dokumenTteId: 'doc-new',
          }),
          update: jest.fn().mockResolvedValue(undefined),
        },
        riwayatTandaTangan: { findUnique: jest.fn().mockResolvedValue(null) },
        detailSOP: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, // Seharusnya 2, tapi cuma 1 -> drift
      };
      const repo = createRepository(tx);
      const res = await repo.transaksiTandaTanganiBaPjPenyusun({
        pengajuanEvaluasiId: 'x',
        userId: 'u',
        userOpdId: 'opd-1',
        peran: PeranPengguna.PJ_PENYUSUN,
        hashDokumen: 'h',
        nomorDokumen: 'n',
        judulDokumen: 'j',
      });
      expect(res).toEqual({ error: 'SOP_STATUS_DRIFT', expectedCount: 2, updatedCount: 1 });
    });
  });

  describe('transaksiTandaTanganiSemuaSopPengajuan (Tambahan Kasus Kepala OPD)', () => {
    it('seharusnya mengembalikan error EMPTY_SOP jika array nilaiEvaluasi kosong (Worst Case)', async () => {
      const tx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            opdId: 'opd-1',
            status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
            nilaiEvaluasi: [],
          }),
        },
      };
      const repo = createRepository(tx);
      const res = await repo.transaksiTandaTanganiSemuaSopPengajuan({
        pengajuanEvaluasiId: 'x',
        userId: 'u',
        userOpdId: 'opd-1',
        peran: PeranPengguna.KEPALA_OPD,
        signedAt,
        hashDokumen: 'h',
        nomorDokumen: 'n',
        judulDokumen: 'j',
      });
      expect(res).toEqual({ error: 'EMPTY_SOP' });
    });

    it('seharusnya mengembalikan error BAD_SOP_STATUS jika ada sop yang belum diverifikasi organisasi (False Case)', async () => {
      const tx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            opdId: 'opd-1',
            status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
            nilaiEvaluasi: [
              {
                detailSop: { sop: { opdId: 'opd-1' }, status: StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR },
              },
            ],
          }),
        },
      };
      const repo = createRepository(tx);
      const res = await repo.transaksiTandaTanganiSemuaSopPengajuan({
        pengajuanEvaluasiId: 'x',
        userId: 'u',
        userOpdId: 'opd-1',
        peran: PeranPengguna.KEPALA_OPD,
        signedAt,
        hashDokumen: 'h',
        nomorDokumen: 'n',
        judulDokumen: 'j',
      });
      expect(res).toEqual(expect.objectContaining({ error: 'BAD_SOP_STATUS' }));
    });
  });
});
