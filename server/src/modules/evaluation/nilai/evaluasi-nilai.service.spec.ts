import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import {
  HasilEvaluasi,
  JenisPengajuanEvaluasi,
  PeranPengguna,
  StatusTindakLanjut,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../../generated/prisma';
import type { EvaluasiNilaiRepository } from './evaluasi-nilai.repository';
import type { PengajuanEvaluasiRepository } from '../pengajuan/pengajuan-evaluasi.repository';
import { EvaluasiNilaiService } from './evaluasi-nilai.service';

describe('EvaluasiNilaiService', () => {
  const user: JwtAccessPayload = {
    sub: 'evaluator-1',
    email: 'ev@test',
    peran: 'EVALUATOR' as JwtAccessPayload['peran'],
  };

  const penyusunUser: JwtAccessPayload = {
    sub: 'penyusun-1',
    email: 'p@test',
    peran: 'PENYUSUN' as JwtAccessPayload['peran'],
  };

  const pjEvaluatorUser: JwtAccessPayload = {
    sub: 'pj-ev-1',
    email: 'pjev@test',
    peran: PeranPengguna.PJ_EVALUATOR,
  };

  const noopPengajuanRepo = {
    findOpdIdPengguna: jest.fn().mockResolvedValue('opd-1'),
  } as unknown as PengajuanEvaluasiRepository;

  const baseNilaiRow = (overrides: Record<string, unknown> = { nomorBA: 'BA-001' }) => ({
    pengajuanEvaluasiId: 'p1',
    detailSopId: 'd1',
    hasil: HasilEvaluasi.SESUAI,
    catatan: null,
    statusTindakLanjut: null,
    ditindaklanjutiPada: null,
    dinilaiOlehId: user.sub,
    version: 1,
    createdAt: new Date('2026-05-05T10:00:00.000Z'),
    updatedAt: new Date('2026-05-05T10:00:00.000Z'),
    ...overrides,
  });

  const basePengajuanRow = (overrides: Record<string, unknown> = { nomorBA: 'BA-001' }) => ({
    pengajuanEvaluasiId: 'p1',
    opdId: 'opd-1',
    status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
    jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
    nilaiOPD: null,
    tanggalEvaluasi: null,
    tanggalDiselesaikan: null,
    diselesaikanOlehId: null,
    version: 0,
    createdAt: new Date('2026-05-01T10:00:00.000Z'),
    updatedAt: new Date('2026-05-02T10:00:00.000Z'),
    nilaiEvaluasi: [{ detailSopId: 'd1', hasil: HasilEvaluasi.SESUAI }],
    ...overrides,
  });

  describe('isiNilai', () => {
    it('should_forbid_when_bukan_evaluator', async () => {
      const repo = { nomorBA: 'BA-001' } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await expect(
        service.isiNilai(pjEvaluatorUser, 'p1', 'd1', {
          hasil: HasilEvaluasi.SESUAI,
          version: 0,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should_reject_perlu_perbaikan_when_catatan_kosong', async () => {
      const runTransaction = jest.fn();
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await expect(
        service.isiNilai(user, 'p1', 'd1', {
          hasil: HasilEvaluasi.PERLU_PERBAIKAN,
          version: 0,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(runTransaction).not.toHaveBeenCalled();
    });

    it('should_throw_not_found_when_pengajuan_not_sedang_dievaluasi', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
          }),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await expect(
        service.isiNilai(user, 'p1', 'd1', {
          hasil: HasilEvaluasi.SESUAI,
          version: 0,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should_throw_conflict_when_version_mismatch', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          }),
        },
        nilaiEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            version: 1, // Mismatch with expected version 0
          }),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await expect(
        service.isiNilai(user, 'p1', 'd1', {
          hasil: HasilEvaluasi.SESUAI,
          version: 0,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should_set_status_tindak_lanjut_terbuka_when_perlu_perbaikan', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          }),
        },
        nilaiEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            pengajuanEvaluasiId: 'p1',
            detailSopId: 'd1',
            hasil: null,
            catatan: null,
            version: 0,
          }),
          update: jest.fn().mockResolvedValue({
            pengajuanEvaluasiId: 'p1',
            detailSopId: 'd1',
            hasil: HasilEvaluasi.PERLU_PERBAIKAN,
            catatan: 'Perbaiki lampiran',
            statusTindakLanjut: StatusTindakLanjut.TERBUKA,
            version: 1,
            dinilaiOlehId: user.sub,
            createdAt: new Date('2026-05-05T10:00:00.000Z'),
            updatedAt: new Date('2026-05-05T10:00:00.000Z'),
          }),
        },
        logNilaiEvaluasi: {
          create: jest.fn().mockResolvedValue({ nomorBA: 'BA-001' }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        detailSOP: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await service.isiNilai(user, 'p1', 'd1', {
        hasil: HasilEvaluasi.PERLU_PERBAIKAN,
        catatan: 'Perbaiki lampiran',
        version: 0,
      });
      expect(mockTx.nilaiEvaluasi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            statusTindakLanjut: StatusTindakLanjut.TERBUKA,
            ditindaklanjutiPada: null,
            ditindaklanjutiOlehId: null,
          }),
        }),
      );
      expect(mockTx.detailSOP.updateMany).toHaveBeenCalled();
    });

    it('should_clear_status_tindak_lanjut_when_sesuai', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          }),
        },
        nilaiEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            pengajuanEvaluasiId: 'p1',
            detailSopId: 'd1',
            hasil: HasilEvaluasi.PERLU_PERBAIKAN,
            catatan: 'lama',
            statusTindakLanjut: StatusTindakLanjut.TERBUKA,
            version: 1,
          }),
          update: jest.fn().mockResolvedValue({
            pengajuanEvaluasiId: 'p1',
            detailSopId: 'd1',
            hasil: HasilEvaluasi.SESUAI,
            catatan: null,
            statusTindakLanjut: null,
            version: 2,
            dinilaiOlehId: user.sub,
            createdAt: new Date('2026-05-05T10:00:00.000Z'),
            updatedAt: new Date('2026-05-05T10:00:00.000Z'),
          }),
        },
        logNilaiEvaluasi: {
          create: jest.fn().mockResolvedValue({ nomorBA: 'BA-001' }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        detailSOP: { updateMany: jest.fn() },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await service.isiNilai(user, 'p1', 'd1', {
        hasil: HasilEvaluasi.SESUAI,
        version: 1,
      });
      expect(mockTx.nilaiEvaluasi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            statusTindakLanjut: null,
          }),
        }),
      );
    });

    it('should_write_log_with_previous_hasil_and_catatan', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          }),
        },
        nilaiEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            pengajuanEvaluasiId: 'p1',
            detailSopId: 'd1',
            hasil: HasilEvaluasi.PERLU_PERBAIKAN,
            catatan: 'catatan lama',
            statusTindakLanjut: null,
            version: 3,
          }),
          update: jest.fn().mockResolvedValue({
            pengajuanEvaluasiId: 'p1',
            detailSopId: 'd1',
            hasil: HasilEvaluasi.SESUAI,
            catatan: 'catatan baru',
            statusTindakLanjut: null,
            version: 4,
            dinilaiOlehId: user.sub,
            createdAt: new Date('2026-05-05T10:00:00.000Z'),
            updatedAt: new Date('2026-05-05T10:00:00.000Z'),
          }),
        },
        logNilaiEvaluasi: {
          create: jest.fn().mockResolvedValue({ nomorBA: 'BA-001' }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await service.isiNilai(user, 'p1', 'd1', {
        hasil: HasilEvaluasi.SESUAI,
        catatan: 'catatan baru',
        version: 3,
      });
      expect(mockTx.logNilaiEvaluasi.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pengajuanEvaluasiId: 'p1',
          detailSopId: 'd1',
          penggunaId: user.sub,
          hasilSebelum: HasilEvaluasi.PERLU_PERBAIKAN,
          hasilSesudah: HasilEvaluasi.SESUAI,
          catatanSebelum: 'catatan lama',
          catatanSesudah: 'catatan baru',
          statusTindakLanjutSebelum: null,
          statusTindakLanjutSesudah: null,
          createdAt: expect.any(Date),
        }),
      });
    });

    it('seharusnya menolak PERLU_PERBAIKAN dengan catatan hanya spasi dan tidak membuka transaksi (Edge Case)', async () => {
      const runTransaction = jest.fn();
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.isiNilai(user, 'p1', 'd1', {
          hasil: HasilEvaluasi.PERLU_PERBAIKAN,
          catatan: '   ',
          version: 0,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(runTransaction).not.toHaveBeenCalled();
    });

    it('seharusnya melempar NotFoundException ketika pengajuan tidak ditemukan (False Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.isiNilai(user, 'p1', 'd1', { hasil: HasilEvaluasi.SESUAI }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar NotFoundException ketika baris nilai tidak ada dalam pengajuan (False Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          }),
        },
        nilaiEvaluasi: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.isiNilai(user, 'p1', 'd1', { hasil: HasilEvaluasi.SESUAI }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya memakai version default 0 dan trim catatan sebelum update dan log (Edge/Worst Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          }),
        },
        nilaiEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            pengajuanEvaluasiId: 'p1',
            detailSopId: 'd1',
            hasil: null,
            catatan: null,
            statusTindakLanjut: null,
            version: 0,
          }),
          update: jest.fn().mockResolvedValue(
            baseNilaiRow({
              hasil: HasilEvaluasi.PERLU_PERBAIKAN,
              catatan: 'Catatan rapi',
              statusTindakLanjut: StatusTindakLanjut.TERBUKA,
              version: 1,
            }),
          ),
        },
        logNilaiEvaluasi: {
          create: jest.fn().mockResolvedValue({ nomorBA: 'BA-001' }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        detailSOP: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      const out = await service.isiNilai(user, 'p1', 'd1', {
        hasil: HasilEvaluasi.PERLU_PERBAIKAN,
        catatan: '  Catatan rapi  ',
      });

      expect(mockTx.nilaiEvaluasi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            catatan: 'Catatan rapi',
            version: { increment: 1 },
            dinilaiOlehId: user.sub,
          }),
        }),
      );
      expect(mockTx.logNilaiEvaluasi.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          catatanSesudah: 'Catatan rapi',
        }),
      });
      expect(out.id).toBe('p1:d1');
      expect(out.statusTindakLanjut).toBe(StatusTindakLanjut.TERBUKA);
    });

    it('seharusnya tidak menghapus status tindak lanjut SELESAI ketika nilai diubah menjadi SESUAI (Edge Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          }),
        },
        nilaiEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            pengajuanEvaluasiId: 'p1',
            detailSopId: 'd1',
            hasil: HasilEvaluasi.PERLU_PERBAIKAN,
            catatan: 'lama',
            statusTindakLanjut: StatusTindakLanjut.SELESAI,
            version: 2,
          }),
          update: jest.fn().mockResolvedValue(
            baseNilaiRow({
              hasil: HasilEvaluasi.SESUAI,
              statusTindakLanjut: StatusTindakLanjut.SELESAI,
              version: 3,
            }),
          ),
        },
        logNilaiEvaluasi: {
          create: jest.fn().mockResolvedValue({ nomorBA: 'BA-001' }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await service.isiNilai(user, 'p1', 'd1', {
        hasil: HasilEvaluasi.SESUAI,
        version: 2,
      });

      const updateArg = mockTx.nilaiEvaluasi.update.mock.calls[0][0];
      expect(updateArg.data).not.toHaveProperty('statusTindakLanjut');
      expect(updateArg.data).not.toHaveProperty('ditindaklanjutiPada');
      expect(updateArg.data).not.toHaveProperty('ditindaklanjutiOlehId');
    });
  });

  describe('tandaiTindakLanjutSelesai', () => {
    it('should_mark_selesai_when_revisi_and_terbuka', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            opdId: 'opd-1',
          }),
        },
        detailSOP: {
          findFirst: jest.fn().mockResolvedValue({
            status: StatusSOP.REVISI_DARI_EVALUATOR,
          }),
        },
        nilaiEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            hasil: HasilEvaluasi.PERLU_PERBAIKAN,
            catatan: 'catatan',
            statusTindakLanjut: StatusTindakLanjut.TERBUKA,
          }),
          update: jest.fn().mockResolvedValue({
            pengajuanEvaluasiId: 'p1',
            detailSopId: 'd1',
            hasil: HasilEvaluasi.PERLU_PERBAIKAN,
            catatan: 'catatan',
            statusTindakLanjut: StatusTindakLanjut.SELESAI,
            ditindaklanjutiPada: new Date('2026-05-06T10:00:00.000Z'),
            version: 2,
            dinilaiOlehId: 'evaluator-1',
            createdAt: new Date('2026-05-05T10:00:00.000Z'),
            updatedAt: new Date('2026-05-06T10:00:00.000Z'),
          }),
        },
        logNilaiEvaluasi: {
          create: jest.fn().mockResolvedValue({ nomorBA: 'BA-001' }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      const out = await service.tandaiTindakLanjutSelesai(penyusunUser, 'p1', 'd1');
      expect(out.statusTindakLanjut).toBe(StatusTindakLanjut.SELESAI);
      expect(mockTx.nilaiEvaluasi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            statusTindakLanjut: StatusTindakLanjut.SELESAI,
            ditindaklanjutiOlehId: penyusunUser.sub,
            ditindaklanjutiPada: expect.any(Date),
            version: { increment: 1 },
          }),
        }),
      );
      expect(mockTx.logNilaiEvaluasi.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pengajuanEvaluasiId: 'p1',
          detailSopId: 'd1',
          penggunaId: penyusunUser.sub,
          hasilSebelum: HasilEvaluasi.PERLU_PERBAIKAN,
          hasilSesudah: HasilEvaluasi.PERLU_PERBAIKAN,
          catatanSebelum: 'catatan',
          catatanSesudah: 'catatan',
          statusTindakLanjutSebelum: StatusTindakLanjut.TERBUKA,
          statusTindakLanjutSesudah: StatusTindakLanjut.SELESAI,
          ditindaklanjutiOlehId: penyusunUser.sub,
          ditindaklanjutiPada: expect.any(Date),
        }),
      });
    });

    it('seharusnya menolak peran selain penyusun dan PJ penyusun (False Case)', async () => {
      const repo = { runTransaction: jest.fn() } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(service.tandaiTindakLanjutSelesai(user, 'p1', 'd1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repo.runTransaction).not.toHaveBeenCalled();
    });

    it('seharusnya menolak ketika OPD pengguna tidak ditemukan (False Case)', async () => {
      const pengajuanRepo = {
        findOpdIdPengguna: jest.fn().mockResolvedValue(null),
      } as unknown as PengajuanEvaluasiRepository;
      const repo = { runTransaction: jest.fn() } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, pengajuanRepo);

      await expect(
        service.tandaiTindakLanjutSelesai(penyusunUser, 'p1', 'd1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.runTransaction).not.toHaveBeenCalled();
    });

    it('seharusnya menyembunyikan pengajuan beda OPD sebagai NotFound (Worst Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            opdId: 'opd-lain',
          }),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.tandaiTindakLanjutSelesai(penyusunUser, 'p1', 'd1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya menolak pengajuan yang tidak sedang dievaluasi (False Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
            opdId: 'opd-1',
          }),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.tandaiTindakLanjutSelesai(penyusunUser, 'p1', 'd1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya melempar NotFoundException ketika detail SOP tidak ada di OPD pengguna (False Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            opdId: 'opd-1',
          }),
        },
        detailSOP: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.tandaiTindakLanjutSelesai(penyusunUser, 'p1', 'd1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya menolak detail SOP yang belum berstatus revisi dari evaluator (Edge Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            opdId: 'opd-1',
          }),
        },
        detailSOP: {
          findFirst: jest.fn().mockResolvedValue({ status: StatusSOP.SEDANG_DIEVALUASI }),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.tandaiTindakLanjutSelesai(penyusunUser, 'p1', 'd1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('seharusnya melempar NotFoundException ketika baris nilai evaluasi tidak ada (False Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            opdId: 'opd-1',
          }),
        },
        detailSOP: {
          findFirst: jest.fn().mockResolvedValue({ status: StatusSOP.REVISI_DARI_EVALUATOR }),
        },
        nilaiEvaluasi: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.tandaiTindakLanjutSelesai(penyusunUser, 'p1', 'd1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya menolak nilai yang hasilnya bukan PERLU_PERBAIKAN (Edge Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            opdId: 'opd-1',
          }),
        },
        detailSOP: {
          findFirst: jest.fn().mockResolvedValue({ status: StatusSOP.REVISI_DARI_EVALUATOR }),
        },
        nilaiEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            hasil: HasilEvaluasi.SESUAI,
            statusTindakLanjut: null,
          }),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.tandaiTindakLanjutSelesai(penyusunUser, 'p1', 'd1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya menolak tindak lanjut yang sudah SELESAI (Edge Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            opdId: 'opd-1',
          }),
        },
        detailSOP: {
          findFirst: jest.fn().mockResolvedValue({ status: StatusSOP.REVISI_DARI_EVALUATOR }),
        },
        nilaiEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            hasil: HasilEvaluasi.PERLU_PERBAIKAN,
            statusTindakLanjut: StatusTindakLanjut.SELESAI,
          }),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.tandaiTindakLanjutSelesai(penyusunUser, 'p1', 'd1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('seharusnya menolak ketika tidak ada tindak lanjut TERBUKA (Edge Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            opdId: 'opd-1',
          }),
        },
        detailSOP: {
          findFirst: jest.fn().mockResolvedValue({ status: StatusSOP.REVISI_DARI_EVALUATOR }),
        },
        nilaiEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            hasil: HasilEvaluasi.PERLU_PERBAIKAN,
            statusTindakLanjut: null,
          }),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.tandaiTindakLanjutSelesai(penyusunUser, 'p1', 'd1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('assertBolehKirimUlangSetelahRevisi', () => {
    it('should_pass_when_status_masih_terbuka', async () => {
      const repo = {
        findNilaiRevisiAktifForDetail: jest.fn().mockResolvedValue({
          pengajuanEvaluasiId: 'p1',
          detailSopId: 'd1',
          hasil: HasilEvaluasi.PERLU_PERBAIKAN,
          statusTindakLanjut: StatusTindakLanjut.TERBUKA,
        }),
      } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await expect(service.assertBolehKirimUlangSetelahRevisi('d1')).resolves.toBeUndefined();
    });

    it('should_pass_when_status_selesai', async () => {
      const repo = {
        findNilaiRevisiAktifForDetail: jest.fn().mockResolvedValue({
          statusTindakLanjut: StatusTindakLanjut.SELESAI,
        }),
      } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await expect(service.assertBolehKirimUlangSetelahRevisi('d1')).resolves.toBeUndefined();
    });
  });

  describe('selesai', () => {
    it('should_forbid_when_bukan_evaluator', async () => {
      const repo = { nomorBA: 'BA-001' } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await expect(
        service.selesai(pjEvaluatorUser, 'p1', { nomorBA: 'BA-001', nilaiOPD: 5 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should_reject_when_belum_semua_SESUAI', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            pengajuanEvaluasiId: 'p1',
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
            tanggalEvaluasi: null,
            nilaiEvaluasi: [
              { detailSopId: 'a', hasil: HasilEvaluasi.SESUAI },
              { detailSopId: 'b', hasil: HasilEvaluasi.PERLU_PERBAIKAN },
            ],
          }),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await expect(
        service.selesai(user, 'p1', { nomorBA: 'BA-001', nilaiOPD: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should_throw_bad_request_when_selesai_but_status_not_sedang_dievaluasi', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
          }),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await expect(
        service.selesai(user, 'p1', { nomorBA: 'BA-001', nilaiOPD: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should_throw_bad_request_when_selesai_request_opd_with_nilaiOPD', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
          }),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await expect(
        service.selesai(user, 'p1', { nomorBA: 'BA-001', nilaiOPD: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should_throw_bad_request_when_selesai_request_evaluator_without_valid_nilaiOPD', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue({
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
          }),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);
      await expect(service.selesai(user, 'p1', { nomorBA: 'BA-001' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('seharusnya melempar NotFoundException ketika pengajuan tidak ditemukan (False Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.selesai(user, 'p1', { nomorBA: 'BA-001', nilaiOPD: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([
      ['null', null],
      ['nol', 0],
      ['di bawah minimum', -1],
      ['di atas maksimum', 6],
      ['pecahan', 2.5],
    ])(
      'seharusnya menolak nilaiOPD EVALUASI_REQUEST_EVALUATOR yang invalid: %s (Edge Case)',
      async (_label, nilaiOPD) => {
        const mockTx = {
          pengajuanEvaluasi: {
            findUnique: jest.fn().mockResolvedValue(
              basePengajuanRow({
                jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
              }),
            ),
          },
        };
        const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
          fn(mockTx),
        );
        const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
        const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

        await expect(
          service.selesai(user, 'p1', { nomorBA: 'BA-001', nilaiOPD: nilaiOPD as number }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it('seharusnya menolak pengajuan tanpa dokumen nilai (False Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue(
            basePengajuanRow({
              nilaiEvaluasi: [],
            }),
          ),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.selesai(user, 'p1', { nomorBA: 'BA-001', nilaiOPD: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya melempar ConflictException ketika sebagian detail SOP gagal dipromosikan (Worst Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue(
            basePengajuanRow({
              nilaiEvaluasi: [
                { detailSopId: 'd1', hasil: HasilEvaluasi.SESUAI },
                { detailSopId: 'd2', hasil: HasilEvaluasi.SESUAI },
              ],
            }),
          ),
        },
        detailSOP: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.selesai(user, 'p1', { nomorBA: 'BA-001', nilaiOPD: 5 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('seharusnya menyelesaikan evaluasi EVALUASI_REQUEST_EVALUATOR dengan skor batas minimum dan mempertahankan tanggalEvaluasi lama (Edge/Success Case)', async () => {
      const tanggalEvaluasi = new Date('2026-05-10T10:00:00.000Z');
      const finishedRow = {
        ...basePengajuanRow({
          status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
          nilaiOPD: 1,
          tanggalEvaluasi,
          tanggalDiselesaikan: new Date('2026-05-11T10:00:00.000Z'),
          diselesaikanOlehId: user.sub,
          version: 1,
        }),
      };
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(
              basePengajuanRow({
                jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
                tanggalEvaluasi,
                nilaiEvaluasi: [{ detailSopId: 'd1', hasil: HasilEvaluasi.SESUAI }],
              }),
            )
            .mockResolvedValueOnce(null) // existingBA check
            .mockResolvedValueOnce(finishedRow),
          update: jest.fn().mockResolvedValue({ nomorBA: 'BA-001' }),
        },
        detailSOP: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      const out = await service.selesai(user, 'p1', { nomorBA: 'BA-001', nilaiOPD: 1 });

      expect(mockTx.detailSOP.updateMany).toHaveBeenCalledWith({
        where: {
          detailSopId: { in: ['d1'] },
          status: {
            in: [
              StatusSOP.DIAJUKAN_EVALUASI,
              StatusSOP.SEDANG_DIEVALUASI,
              StatusSOP.REVISI_DARI_EVALUATOR,
            ],
          },
        },
        data: { status: StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR },
      });
      expect(mockTx.pengajuanEvaluasi.update).toHaveBeenCalledWith({
        where: { pengajuanEvaluasiId: 'p1' },
        data: expect.objectContaining({
          status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
          nilaiOPD: 1,
          tanggalEvaluasi,
          diselesaikanOlehId: user.sub,
          version: { increment: 1 },
        }),
      });
      expect(out).toEqual(
        expect.objectContaining({
          id: 'p1',
          status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
          nilaiOPD: 1,
          tanggalEvaluasi: tanggalEvaluasi.toISOString(),
          diselesaikanOlehId: user.sub,
          version: 1,
        }),
      );
    });

    it('seharusnya menyelesaikan evaluasi EVALUASI_REQUEST_OPD tanpa nilaiOPD dan menyimpan skor null (Success Case)', async () => {
      const finishedRow = basePengajuanRow({
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
        status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
        nilaiOPD: null,
        tanggalEvaluasi: new Date('2026-05-11T10:00:00.000Z'),
        tanggalDiselesaikan: new Date('2026-05-11T10:00:00.000Z'),
        diselesaikanOlehId: user.sub,
        version: 1,
      });
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(
              basePengajuanRow({
                jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
                nilaiEvaluasi: [{ detailSopId: 'd1', hasil: HasilEvaluasi.SESUAI }],
              }),
            )
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(finishedRow),
          update: jest.fn().mockResolvedValue({ nomorBA: 'BA-001' }),
        },
        detailSOP: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      const out = await service.selesai(user, 'p1', { nomorBA: 'BA-001' });

      expect(mockTx.pengajuanEvaluasi.update).toHaveBeenCalledWith({
        where: { pengajuanEvaluasiId: 'p1' },
        data: expect.objectContaining({
          nilaiOPD: null,
        }),
      });
      expect(out.nilaiOPD).toBeUndefined();
    });

    it('seharusnya melempar ConflictException ketika pengajuan gagal dimuat setelah update (False Case)', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(basePengajuanRow())
            .mockResolvedValueOnce(null),
          update: jest.fn().mockResolvedValue({ nomorBA: 'BA-001' }),
        },
        detailSOP: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const repo = { runTransaction } as unknown as EvaluasiNilaiRepository;
      const service = new EvaluasiNilaiService(repo, noopPengajuanRepo);

      await expect(
        service.selesai(user, 'p1', { nomorBA: 'BA-001', nilaiOPD: 5 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('tolak', () => {
    it('seharusnya menolak pengajuan secara atomik dan mengunci semua versi SOP', async () => {
      const pengajuan = basePengajuanRow({
        nilaiEvaluasi: [
          {
            ...baseNilaiRow({ detailSop: { status: StatusSOP.SEDANG_DIEVALUASI } }),
          },
        ],
      });
      const hasilDitolak = basePengajuanRow({
        status: StatusPengajuanEvaluasi.DITOLAK,
        alasanPenolakan: 'Lengkapi dasar hukum.',
        ditolakOlehId: user.sub,
        tanggalDitolak: new Date('2026-05-06T10:00:00.000Z'),
        version: 1,
      });
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(pengajuan)
            .mockResolvedValueOnce(hasilDitolak),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        logNilaiEvaluasi: { create: jest.fn().mockResolvedValue({}) },
        nilaiEvaluasi: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        detailSOP: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const service = new EvaluasiNilaiService(
        { runTransaction } as unknown as EvaluasiNilaiRepository,
        noopPengajuanRepo,
      );

      const actual = await service.tolak(user, 'p1', {
        alasan: '  Lengkapi dasar hukum.  ',
        version: 0,
      });

      expect(mockTx.pengajuanEvaluasi.updateMany).toHaveBeenCalledWith({
        where: {
          pengajuanEvaluasiId: 'p1',
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          version: 0,
        },
        data: expect.objectContaining({
          status: StatusPengajuanEvaluasi.DITOLAK,
          alasanPenolakan: 'Lengkapi dasar hukum.',
          ditolakOlehId: user.sub,
          version: { increment: 1 },
        }),
      });
      expect(mockTx.nilaiEvaluasi.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hasil: HasilEvaluasi.DITOLAK,
            catatan: 'Lengkapi dasar hukum.',
            statusTindakLanjut: null,
          }),
        }),
      );
      expect(mockTx.detailSOP.updateMany).toHaveBeenCalledWith({
        where: {
          detailSopId: { in: ['d1'] },
          status: {
            in: [
              StatusSOP.DIAJUKAN_EVALUASI,
              StatusSOP.SEDANG_DIEVALUASI,
              StatusSOP.REVISI_DARI_EVALUATOR,
            ],
          },
        },
        data: { status: StatusSOP.DITOLAK_EVALUATOR },
      });
      expect(actual).toEqual(
        expect.objectContaining({
          status: StatusPengajuanEvaluasi.DITOLAK,
          alasanPenolakan: 'Lengkapi dasar hukum.',
          ditolakOlehId: user.sub,
          version: 1,
        }),
      );
    });

    it('seharusnya melarang penolakan oleh selain evaluator', async () => {
      const runTransaction = jest.fn();
      const service = new EvaluasiNilaiService(
        { runTransaction } as unknown as EvaluasiNilaiRepository,
        noopPengajuanRepo,
      );

      await expect(
        service.tolak(pjEvaluatorUser, 'p1', { alasan: 'Tidak sesuai', version: 0 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(runTransaction).not.toHaveBeenCalled();
    });

    it('seharusnya menolak versi pengajuan yang sudah berubah', async () => {
      const mockTx = {
        pengajuanEvaluasi: {
          findUnique: jest.fn().mockResolvedValue(basePengajuanRow({ version: 2 })),
        },
      };
      const runTransaction = jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      );
      const service = new EvaluasiNilaiService(
        { runTransaction } as unknown as EvaluasiNilaiRepository,
        noopPengajuanRepo,
      );

      await expect(
        service.tolak(user, 'p1', { alasan: 'Tidak sesuai', version: 1 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
