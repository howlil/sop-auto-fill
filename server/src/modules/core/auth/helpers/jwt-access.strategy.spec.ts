import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PeranPengguna } from '../../../../generated/prisma';
import { AuthRepository, type PenggunaAuthRecord } from '../auth.repository';
import { JwtAccessStrategy } from './jwt-access.strategy';

describe('Pengujian JwtAccessStrategy', () => {
  let strategy: JwtAccessStrategy;
  let authRepository: jest.Mocked<Pick<AuthRepository, 'findActivePenggunaById'>>;

  const row: PenggunaAuthRecord = {
    penggunaId: 'p-1',
    email: 'tester@example.test',
    opdId: 'opd-1',
    nama: 'Tester',
    kataSandi: 'hashed',
    peran: PeranPengguna.PENYUSUN,
    nip: '198001012009011001',
    jabatan: 'Staf',
    pangkat: 'III/a',
    nohp: '08123456789',
    sesiTokenVersion: 3,
    refreshTokenHash: null,
    refreshTokenExpiresAt: null,
    passwordChangedAt: null,
    ttePinHash: null,
    tteP12Base64: null,
    tteP12PassphraseEncrypted: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    authRepository = {
      findActivePenggunaById: jest.fn(),
    };
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('access-secret-min-32-characters'),
    };
    strategy = new JwtAccessStrategy(
      configService as unknown as ConfigService,
      authRepository as unknown as AuthRepository,
    );
  });

  it('seharusnya mengembalikan payload dari database ketika versi sesi cocok', async () => {
    authRepository.findActivePenggunaById.mockResolvedValue(row);
    const actual = await strategy.validate({
      sub: row.penggunaId,
      email: row.email,
      peran: row.peran,
      sesiTokenVersion: row.sesiTokenVersion,
    });
    expect(actual).toEqual({
      sub: row.penggunaId,
      email: row.email,
      peran: row.peran,
      sesiTokenVersion: row.sesiTokenVersion,
    });
  });

  it('seharusnya menolak payload tanpa versi sesi', async () => {
    await expect(
      strategy.validate({
        sub: row.penggunaId,
        email: row.email,
        peran: row.peran,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authRepository.findActivePenggunaById).not.toHaveBeenCalled();
  });

  it('seharusnya menolak ketika pengguna tidak ditemukan', async () => {
    authRepository.findActivePenggunaById.mockResolvedValue(null);
    await expect(
      strategy.validate({
        sub: row.penggunaId,
        email: row.email,
        peran: row.peran,
        sesiTokenVersion: row.sesiTokenVersion,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('seharusnya menolak ketika versi sesi token tidak sama dengan database', async () => {
    authRepository.findActivePenggunaById.mockResolvedValue(row);
    await expect(
      strategy.validate({
        sub: row.penggunaId,
        email: row.email,
        peran: row.peran,
        sesiTokenVersion: row.sesiTokenVersion - 1,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
