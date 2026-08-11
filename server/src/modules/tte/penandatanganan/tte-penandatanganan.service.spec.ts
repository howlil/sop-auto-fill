import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  JenisDokumenTte,
  PeranPengguna,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../../generated/prisma';
import type { JwtAccessPayload } from '../../../common/types/jwt-access-payload.type';
import type { TteRepository } from '../shared/repository/tte.repository';
import { TtePenandatangananService } from './tte-penandatanganan.service';
import { TtePublicUrlResolver } from '../shared/utils/tte-public-url.resolver';
import { toWibDateOnly } from '../../../common/date/wib-date.util';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('Pengujian TtePenandatangananService', () => {
  const evaluatorUser: JwtAccessPayload = {
    sub: 'user-eval',
    email: 'e@test.id',
    peran: PeranPengguna.PJ_EVALUATOR,
  };

  const pjPenyusunUser: JwtAccessPayload = {
    sub: 'user-pj-penyusun',
    email: 'pjp@test.id',
    peran: PeranPengguna.PJ_PENYUSUN,
  };

  const kepalaUser: JwtAccessPayload = {
    sub: 'user-kep',
    email: 'k@test.id',
    peran: PeranPengguna.KEPALA_OPD,
  };

  const invalidRoleUser: JwtAccessPayload = {
    sub: 'user-invalid',
    email: 'inv@test.id',
    peran: PeranPengguna.EVALUATOR,
  };

  const mockTtePinRow = {
    hashPin: 'hashed-pin',
    updatedAt: new Date(),
  };

  function createRepoMock(
    partial: Partial<jest.Mocked<TteRepository>>,
  ): jest.Mocked<TteRepository> {
    return {
      findPenggunaAktif: jest.fn(),
      findKredensial: jest.fn(),
      transaksiTandaTanganiBaEvaluator: jest.fn(),
      transaksiTandaTanganiBaPjPenyusun: jest.fn(),
      transaksiTandaTanganiSemuaSopPengajuan: jest.fn(),
      prepareSopPengesahanDocuments: jest.fn(),
      finalizeSopPengesahanWithArtifacts: jest.fn(),
      ...partial,
    } as unknown as jest.Mocked<TteRepository>;
  }

  function config() {
    return {
      get: jest.fn((key: string) => {
        if (key === 'PUBLIC_APP_ORIGIN') {
          return 'https://verify.test';
        }
        return undefined;
      }),
    } as unknown as ConfigService;
  }

  function publicUrlResolver() {
    return new TtePublicUrlResolver(config());
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Pengujian Dasar & Validasi PIN', () => {
    it('seharusnya melempar NotFoundException jika pengguna tidak ditemukan', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(null),
      });
      const service = new TtePenandatangananService(repo, publicUrlResolver());

      await expect(
        service.tandaTanganiBa(evaluatorUser, 'pid-1', {
          pin: '1234',
          nomorDokumen: 'DOC',
          judulDokumen: 'Title',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('seharusnya melempar BadRequestException jika kredensial PIN belum dibuat', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest
          .fn()
          .mockResolvedValue({ peran: PeranPengguna.PJ_EVALUATOR } as any),
        findKredensial: jest.fn().mockResolvedValue(null),
      });
      const service = new TtePenandatangananService(repo, publicUrlResolver());

      await expect(
        service.tandaTanganiBa(evaluatorUser, 'pid-1', {
          pin: '1234',
          nomorDokumen: 'DOC',
          judulDokumen: 'Title',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('seharusnya melempar ForbiddenException jika PIN tidak valid', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest
          .fn()
          .mockResolvedValue({ peran: PeranPengguna.PJ_EVALUATOR } as any),
        findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const service = new TtePenandatangananService(repo, publicUrlResolver());

      await expect(
        service.tandaTanganiBa(evaluatorUser, 'pid-1', {
          pin: 'wrong',
          nomorDokumen: 'DOC',
          judulDokumen: 'Title',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('tandaTanganiBa (Skenario PJ_EVALUATOR)', () => {
    let repo: jest.Mocked<TteRepository>;
    let service: TtePenandatangananService;

    beforeEach(() => {
      repo = createRepoMock({
        findPenggunaAktif: jest
          .fn()
          .mockResolvedValue({ peran: PeranPengguna.PJ_EVALUATOR } as any),
        findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      service = new TtePenandatangananService(repo, publicUrlResolver());
    });

    it('seharusnya melempar NotFoundException ketika NOT_FOUND', async () => {
      repo.transaksiTandaTanganiBaEvaluator.mockResolvedValue({ error: 'NOT_FOUND' });
      await expect(
        service.tandaTanganiBa(evaluatorUser, 'pid-1', {
          pin: '1234',
          nomorDokumen: 'D',
          judulDokumen: 'J',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('seharusnya melempar ConflictException ketika BAD_STATUS', async () => {
      repo.transaksiTandaTanganiBaEvaluator.mockResolvedValue({
        error: 'BAD_STATUS',
        status: StatusPengajuanEvaluasi.SELESAI,
      });
      await expect(
        service.tandaTanganiBa(evaluatorUser, 'pid-1', {
          pin: '1234',
          nomorDokumen: 'D',
          judulDokumen: 'J',
        }),
      ).rejects.toThrow(/Pengajuan tidak dapat ditandatangani pada status SELESAI/);
    });

    it('seharusnya melempar ConflictException ketika ALREADY_SIGNED', async () => {
      repo.transaksiTandaTanganiBaEvaluator.mockResolvedValue({ error: 'ALREADY_SIGNED' });
      await expect(
        service.tandaTanganiBa(evaluatorUser, 'pid-1', {
          pin: '1234',
          nomorDokumen: 'D',
          judulDokumen: 'J',
        }),
      ).rejects.toThrow('Berita Acara sudah ditandatangani untuk peran ini');
    });

    it('seharusnya melempar ConflictException ketika INVALID_DOC_PARENT', async () => {
      repo.transaksiTandaTanganiBaEvaluator.mockResolvedValue({ error: 'INVALID_DOC_PARENT' });
      await expect(
        service.tandaTanganiBa(evaluatorUser, 'pid-1', {
          pin: '1234',
          nomorDokumen: 'D',
          judulDokumen: 'J',
        }),
      ).rejects.toThrow('wajib tepat satu referensi parent');
    });

    it('seharusnya melempar ConflictException ketika transaksi tidak sukses (ok=false)', async () => {
      repo.transaksiTandaTanganiBaEvaluator.mockResolvedValue({ ok: false, riwayat: null } as any);
      await expect(
        service.tandaTanganiBa(evaluatorUser, 'pid-1', {
          pin: '1234',
          nomorDokumen: 'D',
          judulDokumen: 'J',
        }),
      ).rejects.toThrow('Gagal menyelesaikan penandatanganan');
    });
  });

  describe('tandaTanganiBa (Skenario PJ_PENYUSUN)', () => {
    let repo: jest.Mocked<TteRepository>;
    let service: TtePenandatangananService;

    beforeEach(() => {
      repo = createRepoMock({
        findPenggunaAktif: jest
          .fn()
          .mockResolvedValue({ peran: PeranPengguna.PJ_PENYUSUN, opdId: 'opd-1' } as any),
        findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      service = new TtePenandatangananService(repo, publicUrlResolver());
    });

    it('seharusnya melempar ForbiddenException ketika FORBIDDEN_OPD', async () => {
      repo.transaksiTandaTanganiBaPjPenyusun.mockResolvedValue({ error: 'FORBIDDEN_OPD' });
      await expect(
        service.tandaTanganiBa(pjPenyusunUser, 'pid-1', {
          pin: '1234',
          nomorDokumen: 'D',
          judulDokumen: 'J',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('seharusnya melempar ConflictException ketika DOC_MISMATCH', async () => {
      repo.transaksiTandaTanganiBaPjPenyusun.mockResolvedValue({ error: 'DOC_MISMATCH' });
      await expect(
        service.tandaTanganiBa(pjPenyusunUser, 'pid-1', {
          pin: '1234',
          nomorDokumen: 'D',
          judulDokumen: 'J',
        }),
      ).rejects.toThrow('Dokumen TTE tidak cocok dengan pengajuan evaluasi');
    });

    it('seharusnya melempar ConflictException ketika SOP_STATUS_DRIFT', async () => {
      repo.transaksiTandaTanganiBaPjPenyusun.mockResolvedValue({
        error: 'SOP_STATUS_DRIFT',
        updatedCount: 1,
        expectedCount: 2,
      });
      await expect(
        service.tandaTanganiBa(pjPenyusunUser, 'pid-1', {
          pin: '1234',
          nomorDokumen: 'D',
          judulDokumen: 'J',
        }),
      ).rejects.toThrow('Status sebagian SOP sudah berubah (1/2)');
    });

    it('seharusnya mengembalikan riwayat jika transaksi PJ Penyusun berhasil', async () => {
      const ditandatanganiPada = new Date();
      repo.transaksiTandaTanganiBaPjPenyusun.mockResolvedValue({
        ok: true,
        riwayat: {
          userId: pjPenyusunUser.sub,
          dokumenTteId: 'doc-1',
          peran: PeranPengguna.PJ_PENYUSUN,
          ditandatanganiPada,
          dokumenTte: {
            dokumenTteId: 'doc-1',
            nomorDokumen: 'BA-1',
            judulDokumen: 'J',
            hashDokumen: 'abc',
            jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI,
            detailSopId: null,
            pengajuanEvaluasiId: 'pid-1',
          },
          user: { penggunaId: pjPenyusunUser.sub, nama: 'Penyusun', nip: '1' },
        },
      } as any);
      const actual = await service.tandaTanganiBa(pjPenyusunUser, 'pid-1', {
        pin: '1234',
        nomorDokumen: 'D',
        judulDokumen: 'J',
      });
      expect(actual.id).toBe('doc-1:user-pj-penyusun');
      expect(actual.peran).toBe('PJ_PENYUSUN');
    });
  });

  describe('tandaTanganiBa (Skenario Role Invalid)', () => {
    it('seharusnya melempar ForbiddenException jika peran bukan PJ_EVALUATOR atau PJ_PENYUSUN', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue({ peran: PeranPengguna.EVALUATOR } as any),
        findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const service = new TtePenandatangananService(repo, publicUrlResolver());

      await expect(
        service.tandaTanganiBa(invalidRoleUser, 'pid-1', {
          pin: '1234',
          nomorDokumen: 'D',
          judulDokumen: 'J',
        }),
      ).rejects.toThrow('Hanya PJ Evaluator atau PJ Penyusun yang dapat menandatangani');
    });
  });

  describe('tandaTanganiSemuaSopPengajuan', () => {
    let repo: jest.Mocked<TteRepository>;
    let service: TtePenandatangananService;
    const preparedOk = {
      ok: true,
      items: [
        {
          detailSopId: 'ds-1',
          sopId: 'sop-1',
          opdId: 'opd-1',
          judulSop: 'SOP',
          nomorSOP: '123',
          versi: 1,
          dokumenTteId: 'doc-1',
          nomorDokumen: 'D-123',
          judulDokumen: 'J - SOP',
        },
      ],
    } as const;
    const buildDto = (detailSopIds = ['ds-1']) => ({
      pin: '1234',
      nomorDokumen: 'D',
      judulDokumen: 'J',
      sopPdfs: detailSopIds.map((detailSopId) => ({
        detailSopId,
        pdfBase64: Buffer.from('%PDF-1.7\n').toString('base64'),
      })),
    });
    const pdfService = {
      buildUnsignedOfficialPdf: jest.fn().mockReturnValue(Buffer.from('%PDF-1.7\n')),
      stampPengesahanMetadata: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7 stamped\n')),
    };
    const storageService = {
      buildRelativePath: jest.fn().mockReturnValue('opd-1/sop-1/v1-ds-1.pdf'),
      writeOfficialPdf: jest.fn().mockResolvedValue({
        relativePath: 'opd-1/sop-1/v1-ds-1.pdf',
        absolutePath: 'x',
        sizeBytes: 12,
        sha256: 'sha256',
      }),
      deleteStoredPdf: jest.fn().mockResolvedValue(undefined),
    };
    const pdfSigningService = {
      signOfficialSopPdfWithUserCertificate: jest.fn().mockResolvedValue({
        signedPdf: Buffer.from('%PDF-1.7 signed\n'),
        sha256SignedPdf: 'sha256',
        signatureFormat: 'PKCS7_DETACHED',
        certificate: {},
        riwayatMetadata: {
          signatureValue: 'sha256:sig',
          signatureAlgorithm: 'SHA256withRSA',
          signatureFormat: 'PKCS7_DETACHED',
          certSerialNumber: '1',
          certIssuer: 'issuer',
          certSubject: 'subject',
          certFingerprint: 'fp',
          certValidFrom: new Date('2026-01-01T00:00:00.000Z'),
          certValidTo: new Date('2027-01-01T00:00:00.000Z'),
        },
      }),
    };

    beforeEach(() => {
      repo = createRepoMock({
        findPenggunaAktif: jest
          .fn()
          .mockResolvedValue({ peran: PeranPengguna.KEPALA_OPD, opdId: 'opd-1' } as any),
        findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jest.clearAllMocks();
      service = new TtePenandatangananService(
        repo,
        publicUrlResolver(),
        pdfService as any,
        storageService as any,
        pdfSigningService as any,
      );
    });

    it('seharusnya melempar ForbiddenException jika peran bukan Kepala OPD', async () => {
      repo.findPenggunaAktif.mockResolvedValue({ peran: PeranPengguna.PJ_PENYUSUN } as any);
      await expect(
        service.tandaTanganiSemuaSopPengajuan(pjPenyusunUser, 'pid-1', buildDto()),
      ).rejects.toThrow('Hanya Kepala OPD yang dapat menandatangani');
    });

    it('seharusnya menerjemahkan error BAD_PENGAJUAN_STATUS', async () => {
      repo.prepareSopPengesahanDocuments.mockResolvedValue({
        error: 'BAD_PENGAJUAN_STATUS',
        status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
      } as any);
      await expect(
        service.tandaTanganiSemuaSopPengajuan(kepalaUser, 'pid-1', buildDto()),
      ).rejects.toThrow(/Pengajuan tidak dapat ditandatangani pada status SEDANG_DIEVALUASI/);
    });

    it('seharusnya menerjemahkan error EMPTY_SOP', async () => {
      repo.prepareSopPengesahanDocuments.mockResolvedValue({ error: 'EMPTY_SOP' });
      await expect(
        service.tandaTanganiSemuaSopPengajuan(kepalaUser, 'pid-1', buildDto()),
      ).rejects.toThrow(BadRequestException);
    });

    it('seharusnya menerjemahkan error BAD_SOP_STATUS', async () => {
      repo.prepareSopPengesahanDocuments.mockResolvedValue({
        error: 'BAD_SOP_STATUS',
        nomorSOP: '123',
        status: StatusSOP.DRAFT,
      } as any);
      await expect(
        service.tandaTanganiSemuaSopPengajuan(kepalaUser, 'pid-1', buildDto()),
      ).rejects.toThrow(/tidak dapat ditandatangani dari status DRAFT/);
    });

    it('seharusnya menerjemahkan error ALREADY_SIGNED', async () => {
      repo.prepareSopPengesahanDocuments.mockResolvedValue({
        error: 'ALREADY_SIGNED',
        detailSopId: 'ds-1',
      });
      await expect(
        service.tandaTanganiSemuaSopPengajuan(kepalaUser, 'pid-1', buildDto()),
      ).rejects.toThrow('SOP ds-1 sudah ditandatangani');
    });

    it('seharusnya menerjemahkan error INVALID_DOC_PARENT', async () => {
      repo.prepareSopPengesahanDocuments.mockResolvedValue({
        error: 'INVALID_DOC_PARENT',
        detailSopId: 'ds-1',
      });
      await expect(
        service.tandaTanganiSemuaSopPengajuan(kepalaUser, 'pid-1', buildDto()),
      ).rejects.toThrow('wajib tepat satu referensi parent');
    });

    it('seharusnya melempar ConflictException ketika ok=false (Gagal sistem)', async () => {
      repo.prepareSopPengesahanDocuments.mockResolvedValue(preparedOk as any);
      repo.finalizeSopPengesahanWithArtifacts.mockResolvedValue({ ok: false } as any);
      await expect(
        service.tandaTanganiSemuaSopPengajuan(kepalaUser, 'pid-1', buildDto()),
      ).rejects.toThrow('Gagal menandatangani seluruh SOP');
    });

    it('seharusnya menolak batch jika PDF kanvas tidak lengkap', async () => {
      repo.prepareSopPengesahanDocuments.mockResolvedValue({
        ok: true,
        items: [
          preparedOk.items[0],
          { ...preparedOk.items[0], detailSopId: 'ds-2', dokumenTteId: 'doc-2' },
        ],
      } as any);
      await expect(
        service.tandaTanganiSemuaSopPengajuan(kepalaUser, 'pid-1', buildDto()),
      ).rejects.toThrow('wajib dikirim tepat satu untuk setiap SOP');
      expect(pdfSigningService.signOfficialSopPdfWithUserCertificate).not.toHaveBeenCalled();
    });

    it('seharusnya mengembalikan response batch berhasil ketika transaksi OK', async () => {
      repo.prepareSopPengesahanDocuments.mockResolvedValue({
        ok: true,
        items: Array.from({ length: 5 }).map((_, index) => ({
          ...preparedOk.items[0],
          detailSopId: `ds-${index + 1}`,
          dokumenTteId: `doc-${index + 1}`,
        })),
      } as any);
      repo.finalizeSopPengesahanWithArtifacts.mockResolvedValue({
        ok: true,
        totalSopDitandatangani: 5,
      } as any);
      const actual = await service.tandaTanganiSemuaSopPengajuan(
        kepalaUser,
        'pid-1',
        buildDto(Array.from({ length: 5 }).map((_, index) => `ds-${index + 1}`)),
      );
      expect(actual.totalSopDitandatangani).toBe(5);
      expect(actual.pengajuanEvaluasiId).toBe('pid-1');
      expect(actual.ditandatanganiPada).toBeDefined();
      const finalizeParams = repo.finalizeSopPengesahanWithArtifacts.mock.calls[0]?.[0];
      expect(finalizeParams).toBeDefined();
      if (finalizeParams === undefined) throw new Error('Finalisasi pengesahan tidak dipanggil.');
      expect(finalizeParams.tanggalEfektif).toEqual(toWibDateOnly(finalizeParams.signedAt));
      expect(pdfService.stampPengesahanMetadata).toHaveBeenCalledWith({
        detailSopId: 'ds-1',
        pdfBuffer: Buffer.from('%PDF-1.7\n'),
        qrPayload: 'https://verify.test/validasi/pengesahan/doc-1/user-kep',
        tanggalEfektif: finalizeParams.tanggalEfektif,
      });
      expect(pdfSigningService.signOfficialSopPdfWithUserCertificate).toHaveBeenCalledWith(
        expect.objectContaining({
          dokumenTteId: 'doc-1',
          pdfBuffer: Buffer.from('%PDF-1.7 stamped\n'),
        }),
      );
    });
  });
});
