import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { JwtAccessPayload } from '../../../common/types/jwt-access-payload.type';
import { PeranPengguna } from '../../../generated/prisma';
import type { TteRepository } from '../shared/repository/tte.repository';
import { TteProfilService } from './tte-profil.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../shared/utils/generate-p12.util', () => ({
  generatePersonalP12: jest.fn().mockReturnValue(Buffer.from('dummy-p12')),
}));

jest.mock('../shared/utils/tte-crypto.util', () => ({
  encryptP12Passphrase: jest.fn().mockReturnValue('encrypted-passphrase'),
}));

jest.mock('../shared/utils/pdf-signing-certificate.util', () => ({
  loadTrustedCertificatesFromP12: jest.fn().mockReturnValue(true),
}));

describe('Pengujian TteProfilService', () => {
  const user: JwtAccessPayload = {
    sub: 'user-1',
    email: 'kepala@test.id',
    peran: PeranPengguna.KEPALA_OPD,
  };
  const updatedAt = new Date('2026-05-20T03:04:05.000Z');
  const kredensial = { hashPin: 'hash-lama', updatedAt };

  function pengguna(peran: PeranPengguna = PeranPengguna.KEPALA_OPD) {
    return {
      penggunaId: user.sub,
      email: user.email,
      nama: 'Kepala OPD',
      nip: '198001012006041001',
      jabatan: 'Kepala Dinas',
      pangkat: 'Pembina',
      peran,
      opdId: 'opd-1',
    };
  }

  function createRepoMock(
    partial: Partial<jest.Mocked<TteRepository>> = {},
  ): jest.Mocked<TteRepository> {
    return {
      findPenggunaAktif: jest.fn(),
      findKredensial: jest.fn(),
      createKredensialPin: jest.fn(),
      updateKredensialPinHash: jest.fn(),
      findRiwayatPengesahanByUserAndDokumen: jest.fn(),
      findBeritaAcaraArsipForPdfSigning: jest.fn(),
      findRiwayatForPdfSigning: jest.fn(),
      updateRiwayatPdfSignatureMetadata: jest.fn(),
      findRiwayatByPdfSignatureBinding: jest.fn(),
      assertRiwayatBelumAda: jest.fn(),
      transaksiTandaTanganiBaEvaluator: jest.fn(),
      transaksiTandaTanganiBaPjPenyusun: jest.fn(),
      transaksiTandaTanganiSemuaSopPengajuan: jest.fn(),
      ...partial,
    } as unknown as jest.Mocked<TteRepository>;
  }

  function service(repo: jest.Mocked<TteRepository>) {
    return new TteProfilService(repo);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash-baru');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  describe('getProfil', () => {
    it('seharusnya melempar NotFoundException ketika pengguna aktif tidak ditemukan', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(null),
      });

      await expect(service(repo).getProfil(user)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findKredensial).not.toHaveBeenCalled();
    });

    it('seharusnya mengembalikan null ketika pengguna ada tetapi PIN TTE belum dibuat', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(pengguna()),
        findKredensial: jest.fn().mockResolvedValue(null),
      });

      await expect(service(repo).getProfil(user)).resolves.toBeNull();
      expect(repo.findPenggunaAktif).toHaveBeenCalledWith(user.sub);
      expect(repo.findKredensial).toHaveBeenCalledWith(user.sub);
    });

    it.each([
      [PeranPengguna.KEPALA_OPD, 'KEPALA_OPD'],
      [PeranPengguna.PJ_EVALUATOR, 'PJ_EVALUATOR'],
      [PeranPengguna.PJ_PENYUSUN, 'PJ_PENYUSUN'],
    ] as const)('seharusnya memetakan profil untuk peran %s', async (peran, expectedPeran) => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(pengguna(peran)),
        findKredensial: jest.fn().mockResolvedValue(kredensial),
      });

      const actual = await service(repo).getProfil(user);

      expect(actual).toEqual({
        id: user.sub,
        userId: user.sub,
        peran: expectedPeran,
        hasP12: false,
        createdAt: updatedAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        user: {
          id: user.sub,
          nama: 'Kepala OPD',
          email: user.email,
          nip: '198001012006041001',
          jabatan: 'Kepala Dinas',
          pangkat: 'Pembina',
        },
      });
    });

    it('seharusnya menolak peran aktif yang tidak mendukung TTE', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(pengguna(PeranPengguna.PENYUSUN)),
        findKredensial: jest.fn().mockResolvedValue(kredensial),
      });

      await expect(service(repo).getProfil(user)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('registerProfil', () => {
    it('seharusnya melempar NotFoundException dan berhenti ketika user tidak aktif', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(null),
      });

      await expect(service(repo).registerProfil(user, { pin: '1234' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.findKredensial).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(repo.createKredensialPin).not.toHaveBeenCalled();
    });

    it('seharusnya melempar ConflictException dan tidak hash PIN ketika kredensial sudah ada', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(pengguna()),
        findKredensial: jest.fn().mockResolvedValue(kredensial),
      });

      await expect(service(repo).registerProfil(user, { pin: '1234' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(repo.createKredensialPin).not.toHaveBeenCalled();
    });

    it('seharusnya hash PIN dengan cost 10 lalu membuat kredensial baru', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(pengguna()),
        findKredensial: jest.fn().mockResolvedValue(null),
        createKredensialPin: jest.fn().mockResolvedValue(kredensial),
      });

      const actual = await service(repo).registerProfil(user, { pin: '1234' });

      expect(bcrypt.hash).toHaveBeenCalledWith('1234', 10);
      expect(repo.createKredensialPin).toHaveBeenCalledWith({
        userId: user.sub,
        hashPin: 'hash-baru',
      });
      expect(actual.userId).toBe(user.sub);
      expect(actual.updatedAt).toBe(updatedAt.toISOString());
    });

    it('seharusnya meneruskan error repository saat create kredensial gagal', async () => {
      const dbError = new Error('database down');
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(pengguna()),
        findKredensial: jest.fn().mockResolvedValue(null),
        createKredensialPin: jest.fn().mockRejectedValue(dbError),
      });

      await expect(service(repo).registerProfil(user, { pin: '1234' })).rejects.toThrow(dbError);
      expect(bcrypt.hash).toHaveBeenCalledWith('1234', 10);
    });
  });

  describe('updateProfilPin', () => {
    it('seharusnya melempar NotFoundException dan tidak membaca kredensial ketika user tidak aktif', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service(repo).updateProfilPin(user, { pinLama: '1234', pinBaru: '5678' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findKredensial).not.toHaveBeenCalled();
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(repo.updateKredensialPinHash).not.toHaveBeenCalled();
    });

    it('seharusnya melempar BadRequestException ketika PIN belum pernah dibuat', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(pengguna()),
        findKredensial: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service(repo).updateProfilPin(user, { pinLama: '1234', pinBaru: '5678' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(repo.updateKredensialPinHash).not.toHaveBeenCalled();
    });

    it('seharusnya melempar UnauthorizedException ketika PIN lama salah', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(pengguna()),
        findKredensial: jest.fn().mockResolvedValue(kredensial),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service(repo).updateProfilPin(user, { pinLama: '0000', pinBaru: '5678' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(bcrypt.compare).toHaveBeenCalledWith('0000', kredensial.hashPin);
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(repo.updateKredensialPinHash).not.toHaveBeenCalled();
    });

    it('seharusnya compare PIN lama, hash PIN baru, lalu update kredensial', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(pengguna()),
        findKredensial: jest.fn().mockResolvedValue(kredensial),
        updateKredensialPinHash: jest.fn().mockResolvedValue({
          hashPin: 'hash-baru',
          updatedAt,
        }),
      });

      const actual = await service(repo).updateProfilPin(user, {
        pinLama: '1234',
        pinBaru: '5678',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith('1234', kredensial.hashPin);
      expect(bcrypt.hash).toHaveBeenCalledWith('5678', 10);
      expect(repo.updateKredensialPinHash).toHaveBeenCalledWith({
        userId: user.sub,
        hashPin: 'hash-baru',
      });
      expect(actual.userId).toBe(user.sub);
    });

    it('seharusnya meneruskan error repository saat update hash PIN gagal', async () => {
      const dbError = new Error('deadlock');
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(pengguna()),
        findKredensial: jest.fn().mockResolvedValue(kredensial),
        updateKredensialPinHash: jest.fn().mockRejectedValue(dbError),
      });

      await expect(
        service(repo).updateProfilPin(user, { pinLama: '1234', pinBaru: '5678' }),
      ).rejects.toThrow(dbError);
      expect(bcrypt.hash).toHaveBeenCalledWith('5678', 10);
    });
  });

  describe('generateP12', () => {
    it('seharusnya melempar NotFoundException jika pengguna tidak ditemukan', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(null),
      });

      await expect(service(repo).generateP12(user, { pin: '1234' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('seharusnya membuat kredensial p12 untuk pengguna', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(pengguna()),
        findKredensial: jest.fn().mockResolvedValue(kredensial),
        updateKredensialP12: jest.fn().mockResolvedValue({
          userId: user.sub,
          p12Base64: 'dummy',
          updatedAt,
        }),
      });

      const actual = await service(repo).generateP12(user, { pin: '1234' });

      expect(repo.updateKredensialP12).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.sub,
          p12Base64: Buffer.from('dummy-p12').toString('base64'),
          p12PassphraseEncrypted: 'encrypted-passphrase',
        }),
      );
      expect(actual.hasP12).toBe(true);
    });
  });

  describe('uploadP12', () => {
    it('seharusnya melempar NotFoundException jika pengguna tidak ditemukan', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service(repo).uploadP12(
          user,
          { pin: '1234', p12Passphrase: 'pass' },
          { buffer: Buffer.from('file') },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya mengunggah dan menyimpan file p12', async () => {
      const repo = createRepoMock({
        findPenggunaAktif: jest.fn().mockResolvedValue(pengguna()),
        findKredensial: jest.fn().mockResolvedValue(kredensial),
        updateKredensialP12: jest.fn().mockResolvedValue({
          userId: user.sub,
          p12Base64: 'dummy',
          updatedAt,
        }),
      });

      const actual = await service(repo).uploadP12(
        user,
        { pin: '1234', p12Passphrase: 'pass' },
        { buffer: Buffer.from('file') },
      );

      expect(repo.updateKredensialP12).toHaveBeenCalledWith({
        userId: user.sub,
        p12Base64: Buffer.from('file').toString('base64'),
        p12PassphraseEncrypted: 'encrypted-passphrase',
      });
      expect(actual.hasP12).toBe(true);
    });
  });
});
