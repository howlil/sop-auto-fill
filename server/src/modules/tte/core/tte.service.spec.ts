import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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
import { TtePenandatangananService } from '../penandatanganan/tte-penandatanganan.service';
import { TtePublicUrlResolver } from '../shared/utils/tte-public-url.resolver';
import type { TtePdfSigningService } from '../penandatanganan/tte-pdf-signing.service';
import { TteProfilService } from '../profil/tte-profil.service';
import { TteService } from './tte.service';
import { TteVerifikasiService } from '../verifikasi/tte-verifikasi.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-pin'),
  compare: jest.fn(),
}));

describe('Pengujian TteService', () => {
  const mockTtePinRow = {
    hashPin: 'x',
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  const evaluatorUser: JwtAccessPayload = {
    sub: 'user-eval',
    email: 'e@test.id',
    peran: PeranPengguna.PJ_EVALUATOR,
  };

  const kepalaUser: JwtAccessPayload = {
    sub: 'user-kep',
    email: 'k@test.id',
    peran: PeranPengguna.KEPALA_OPD,
  };

  const pjPenyusunUser: JwtAccessPayload = {
    sub: 'user-pj-penyusun',
    email: 'pjp@test.id',
    peran: PeranPengguna.PJ_PENYUSUN,
  };

  function createRepoMock(
    partial: Partial<jest.Mocked<TteRepository>>,
  ): jest.Mocked<TteRepository> {
    return {
      findPenggunaAktif: jest.fn(),
      findKredensial: jest.fn(),
      createKredensialPin: jest.fn(),
      updateKredensialPinHash: jest.fn(),
      findRiwayatPengesahanByUserAndDokumen: jest.fn(),
      assertRiwayatBelumAda: jest.fn(),
      transaksiTandaTanganiBaEvaluator: jest.fn(),
      transaksiTandaTanganiBaPjPenyusun: jest.fn(),
      transaksiTandaTanganiSemuaSopPengajuan: jest.fn(),
      prepareSopPengesahanDocuments: jest.fn(),
      ...partial,
    } as unknown as jest.Mocked<TteRepository>;
  }

  function config() {
    return {
      get: jest.fn((key: string, def?: string) => {
        if (key === 'NODE_ENV') {
          return 'test';
        }
        return def ?? '';
      }),
    } as unknown as ConfigService;
  }

  function buildTteService(repo: jest.Mocked<TteRepository>, cfg: ConfigService): TteService {
    const profilService = new TteProfilService(repo);
    const pdfSigningService = {
      signPdf: jest.fn(),
    } as unknown as TtePdfSigningService;
    const sopOfficialPdfService = {
      buildUnsignedOfficialPdf: jest.fn().mockReturnValue(Buffer.from('%PDF-1.7\n')),
    } as any;
    const sopPdfStorageService = {} as any;
    const publicUrlResolver = new TtePublicUrlResolver(cfg);
    const penandatangananService = new TtePenandatangananService(
      repo,
      publicUrlResolver,
      sopOfficialPdfService,
      sopPdfStorageService,
      pdfSigningService,
    );
    const verifikasiService = new TteVerifikasiService(repo, publicUrlResolver);
    return new TteService(
      profilService,
      penandatangananService,
      verifikasiService,
      pdfSigningService,
    );
  }

  it('seharusnya melempar error ketika evaluator menandatangani BA dengan status yang salah', async () => {
    const repo = createRepoMock({
      findPenggunaAktif: jest.fn().mockResolvedValue({
        penggunaId: evaluatorUser.sub,
        email: evaluatorUser.email,
        nama: 'Eva',
        nip: '1',
        jabatan: 'PJ',
        pangkat: 'A',
        peran: PeranPengguna.PJ_EVALUATOR,
        opdId: 'opd-1',
      }),
      findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
      transaksiTandaTanganiBaEvaluator: jest.fn().mockResolvedValue({
        error: 'BAD_STATUS',
        status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
      }),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const service = buildTteService(repo, config());
    await expect(
      service.tandaTanganiBa(evaluatorUser, 'pid-1', {
        pin: '1234',
        nomorDokumen: 'BA-1',
        judulDokumen: 'Judul',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('seharusnya melempar error ketika PIN tidak valid', async () => {
    const repo = createRepoMock({
      findPenggunaAktif: jest.fn().mockResolvedValue({
        penggunaId: evaluatorUser.sub,
        email: evaluatorUser.email,
        nama: 'Eva',
        nip: '1',
        jabatan: 'PJ',
        pangkat: 'A',
        peran: PeranPengguna.PJ_EVALUATOR,
        opdId: 'opd-1',
      }),
      findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const service = buildTteService(repo, config());
    await expect(
      service.tandaTanganiBa(evaluatorUser, 'pid-1', {
        pin: '9999',
        nomorDokumen: 'BA-1',
        judulDokumen: 'Judul',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('seharusnya mengembalikan riwayat ketika BA evaluator valid', async () => {
    const ditandatanganiPada = new Date('2026-01-01T00:00:00.000Z');
    const riwayatRow = {
      userId: evaluatorUser.sub,
      dokumenTteId: 'doc-1',
      peran: PeranPengguna.PJ_EVALUATOR,
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
      user: { penggunaId: evaluatorUser.sub, nama: 'Eva', nip: '1' },
    };
    const repo = createRepoMock({
      findPenggunaAktif: jest.fn().mockResolvedValue({
        penggunaId: evaluatorUser.sub,
        email: evaluatorUser.email,
        nama: 'Eva',
        nip: '1',
        jabatan: 'PJ',
        pangkat: 'A',
        peran: PeranPengguna.PJ_EVALUATOR,
        opdId: 'opd-1',
      }),
      findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
      transaksiTandaTanganiBaEvaluator: jest.fn().mockResolvedValue({
        ok: true,
        riwayat: riwayatRow,
      }),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const service = buildTteService(repo, config());
    const actual = await service.tandaTanganiBa(evaluatorUser, 'pid-1', {
      pin: '1234',
      nomorDokumen: 'BA-1',
      judulDokumen: 'J',
    });
    expect(actual.id).toBe('doc-1:user-eval');
    expect(actual.peran).toBe('PJ_EVALUATOR');
    expect(actual.nomorDokumen).toBe('BA-1');
  });

  it('seharusnya melempar ConflictException ketika status SOP drift saat PJ Penyusun menandatangani BA', async () => {
    const repo = createRepoMock({
      findPenggunaAktif: jest.fn().mockResolvedValue({
        penggunaId: pjPenyusunUser.sub,
        email: pjPenyusunUser.email,
        nama: 'PJ Penyusun',
        nip: '2',
        jabatan: 'PJ',
        pangkat: 'A',
        peran: PeranPengguna.PJ_PENYUSUN,
        opdId: 'opd-1',
      }),
      findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
      transaksiTandaTanganiBaPjPenyusun: jest.fn().mockResolvedValue({
        error: 'SOP_STATUS_DRIFT',
        expectedCount: 2,
        updatedCount: 1,
      }),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const service = buildTteService(repo, config());
    await expect(
      service.tandaTanganiBa(pjPenyusunUser, 'pid-1', {
        pin: '1234',
        nomorDokumen: 'BA-1',
        judulDokumen: 'J',
      }),
    ).rejects.toThrow('Status sebagian SOP sudah berubah (1/2)');
  });

  it('seharusnya melempar NotFoundException untuk tidak dikenal pengguna pada profil', async () => {
    const repo = createRepoMock({
      findPenggunaAktif: jest.fn().mockResolvedValue(null),
    });
    const service = buildTteService(repo, config());
    await expect(service.getProfil(kepalaUser)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seharusnya melempar NotFoundException ketika getPengesahanPublic tidak menemukan riwayat', async () => {
    const repo = createRepoMock({
      findRiwayatPengesahanByUserAndDokumen: jest.fn().mockResolvedValue(null),
    });
    const service = buildTteService(repo, config());
    await expect(
      service.getPengesahanPublic(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seharusnya mengembalikan pengesahan publik ketika riwayat masih ada', async () => {
    const ditandatanganiPada = new Date('2026-02-01T12:00:00.000Z');
    const dokumenTteId = '00000000-0000-4000-8000-0000000000bb';
    const userId = '00000000-0000-4000-8000-0000000000aa';
    const repo = createRepoMock({
      findRiwayatPengesahanByUserAndDokumen: jest.fn().mockResolvedValue({
        userId,
        dokumenTteId,
        peran: PeranPengguna.PJ_EVALUATOR,
        ditandatanganiPada,
        dokumenTte: {
          dokumenTteId,
          nomorDokumen: 'BA-99',
          judulDokumen: 'Berita Acara',
          hashDokumen: 'deadbeef',
          jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI,
          detailSopId: null,
          pengajuanEvaluasiId: 'pe-1',
        },
        user: {
          penggunaId: userId,
          nama: 'Evaluator',
          nip: '198001011234567890',
          jabatan: 'PJ Evaluator',
        },
      }),
    });
    const service = buildTteService(repo, config());
    const actual = await service.getPengesahanPublic(dokumenTteId, userId);
    expect(actual.userId).toBe(userId);
    expect(actual.dokumenTteId).toBe(dokumenTteId);
    expect(actual.peran).toBe('PJ_EVALUATOR');
    expect(actual.penandatangan.nama).toBe('Evaluator');
    expect(actual.dokumen.nomorDokumen).toBe('BA-99');
    expect(actual.dokumen.pengajuanEvaluasiId).toBe('pe-1');
    expect(actual.qrVerificationUrl).toBeNull();
    expect(JSON.parse(actual.qrPayload)).toEqual({
      t: 'tte-verify-v1',
      dokumenTteId,
      hashDokumen: 'deadbeef',
    });
  });

  const mockPengguna = {
    penggunaId: evaluatorUser.sub,
    email: evaluatorUser.email,
    nama: 'Eva',
    nip: '1',
    jabatan: 'PJ',
    pangkat: 'A',
    peran: PeranPengguna.PJ_EVALUATOR,
    opdId: 'opd-1',
  };

  it('seharusnya membuat PIN ketika register profil dan PIN belum ada', async () => {
    const repo = createRepoMock({
      findPenggunaAktif: jest.fn().mockResolvedValue(mockPengguna),
      findKredensial: jest.fn().mockResolvedValue(null),
      createKredensialPin: jest.fn().mockResolvedValue(mockTtePinRow),
    });
    const service = buildTteService(repo, config());
    const actual = await service.registerProfil(evaluatorUser, { pin: '1234' });
    expect(actual.userId).toBe(evaluatorUser.sub);
    expect(repo.createKredensialPin).toHaveBeenCalled();
  });

  it('seharusnya melempar ConflictException ketika register profil tetapi PIN sudah ada', async () => {
    const repo = createRepoMock({
      findPenggunaAktif: jest.fn().mockResolvedValue(mockPengguna),
      findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
    });
    const service = buildTteService(repo, config());
    await expect(service.registerProfil(evaluatorUser, { pin: '1234' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('seharusnya memperbarui PIN ketika PIN lama valid', async () => {
    const repo = createRepoMock({
      findPenggunaAktif: jest.fn().mockResolvedValue(mockPengguna),
      findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
      updateKredensialPinHash: jest.fn().mockResolvedValue(mockTtePinRow),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const service = buildTteService(repo, config());
    const actual = await service.updateProfilPin(evaluatorUser, {
      pinLama: '1234',
      pinBaru: '5678',
    });
    expect(actual.userId).toBe(evaluatorUser.sub);
    expect(repo.updateKredensialPinHash).toHaveBeenCalled();
  });

  it('seharusnya melempar UnauthorizedException ketika PIN lama salah saat memperbarui profil PIN', async () => {
    const repo = createRepoMock({
      findPenggunaAktif: jest.fn().mockResolvedValue(mockPengguna),
      findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const service = buildTteService(repo, config());
    await expect(
      service.updateProfilPin(evaluatorUser, { pinLama: 'wrong', pinBaru: '5678' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('seharusnya menampilkan konteks detail status ketika batch penandatanganan memiliki SOP yang tidak memenuhi syarat', async () => {
    const repo = createRepoMock({
      findPenggunaAktif: jest.fn().mockResolvedValue({
        penggunaId: kepalaUser.sub,
        email: kepalaUser.email,
        nama: 'Kepala',
        nip: '3',
        jabatan: 'Kepala OPD',
        pangkat: 'A',
        peran: PeranPengguna.KEPALA_OPD,
        opdId: 'opd-1',
      }),
      findKredensial: jest.fn().mockResolvedValue(mockTtePinRow),
      prepareSopPengesahanDocuments: jest.fn().mockResolvedValue({
        ok: false,
        error: 'BAD_SOP_STATUS',
        detailSopId: 'detail-1',
        nomorSOP: 'SOP-DINKES-001-V1',
        judulSOP: 'Pelayanan Surat Keterangan Sehat',
        status: StatusSOP.BERLAKU,
        expectedStatus: StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI,
      }),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const service = buildTteService(repo, config());
    await expect(
      service.tandaTanganiSemuaSopPengajuan(kepalaUser, 'peng-1', {
        pin: '1234',
        nomorDokumen: 'DOC-1',
        judulDokumen: 'Judul Dokumen',
        sopPdfs: [
          {
            detailSopId: 'detail-1',
            pdfBase64: Buffer.from('%PDF-1.7\n').toString('base64'),
          },
        ],
      }),
    ).rejects.toThrow(
      'SOP SOP-DINKES-001-V1 (Pelayanan Surat Keterangan Sehat) tidak dapat ditandatangani dari status BERLAKU. Status yang diwajibkan: DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI.',
    );
  });

  it('seharusnya mendelegasikan signPdf ke pdfSigningService (Edge Case Delegation)', async () => {
    const repo = createRepoMock({});
    const service = buildTteService(repo, config());
    (service as any).pdfSigningService.signPdf.mockResolvedValueOnce({ status: 'OK' });
    const actual = await service.signPdf(evaluatorUser, {
      fileBase64: 'base64',
      pin: '123',
    } as any);
    expect(actual).toEqual({ status: 'OK' });
    expect((service as any).pdfSigningService.signPdf).toHaveBeenCalled();
  });

  it('seharusnya mendelegasikan getPdfSigningStatus ke pdfSigningService (Edge Case Delegation)', () => {
    const repo = createRepoMock({});
    const service = buildTteService(repo, config());
    (service as any).pdfSigningService.getPdfSigningStatus = jest
      .fn()
      .mockReturnValue({ available: true });
    const actual = service.getPdfSigningStatus();
    expect(actual).toEqual({ available: true });
    expect((service as any).pdfSigningService.getPdfSigningStatus).toHaveBeenCalled();
  });

  it('seharusnya mendelegasikan verifyPdf ke pdfSigningService (Edge Case Delegation)', async () => {
    const repo = createRepoMock({});
    const service = buildTteService(repo, config());
    (service as any).pdfSigningService.verifyPdf = jest.fn().mockResolvedValueOnce({ valid: true });
    const actual = await service.verifyPdf({ pdfBase64: 'base64' });
    expect(actual).toEqual({ valid: true });
    expect((service as any).pdfSigningService.verifyPdf).toHaveBeenCalled();
  });
});
