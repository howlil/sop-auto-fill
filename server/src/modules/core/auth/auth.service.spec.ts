jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthRepository, type PenggunaAuthRecord } from './auth.repository';
import { AuthService } from './auth.service';

describe('Pengujian AuthService', () => {
  let service: AuthService;
  let authRepository: jest.Mocked<
    Pick<
      AuthRepository,
      | 'findActivePenggunaByEmail'
      | 'findActivePenggunaById'
      | 'updateKataSandi'
      | 'updateNohp'
      | 'startSession'
      | 'storeRefreshToken'
      | 'revokeSession'
    >
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;

  const sampleRow: PenggunaAuthRecord = {
    penggunaId: 'p-1',
    email: 'a@b.c',
    opdId: 'opd-1',
    nama: 'Tester',
    kataSandi: 'hashed',
    peran: 'PENYUSUN',
    nip: '198001012009011001',
    jabatan: 'Staf',
    pangkat: 'III/a',
    nohp: '08123456789',
    sesiTokenVersion: 0,
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

  beforeEach(async () => {
    (bcrypt.compare as jest.Mock).mockReset();
    (bcrypt.hash as jest.Mock).mockReset();
    (bcrypt.hash as jest.Mock).mockResolvedValue('refresh-hash');
    authRepository = {
      findActivePenggunaByEmail: jest.fn(),
      findActivePenggunaById: jest.fn(),
      updateKataSandi: jest.fn().mockResolvedValue(undefined),
      updateNohp: jest.fn(),
      startSession: jest.fn().mockResolvedValue({
        ...sampleRow,
        sesiTokenVersion: sampleRow.sesiTokenVersion + 1,
      }),
      storeRefreshToken: jest.fn().mockResolvedValue({
        ...sampleRow,
        sesiTokenVersion: sampleRow.sesiTokenVersion + 1,
        refreshTokenHash: 'refresh-hash',
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
      revokeSession: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt'),
      verifyAsync: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'JWT_EXPIRATION') {
          return '15m';
        }
        if (key === 'JWT_REFRESH_EXPIRATION') {
          return '7d';
        }
        if (key === 'JWT_REFRESH_SECRET') {
          return 'refresh-secret-min-32-characters';
        }
        if (key === 'JWT_SECRET') {
          return 'access-secret-min-32-characters';
        }
        return defaultValue;
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: authRepository },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('seharusnya melempar UnauthorizedException ketika pengguna tidak ditemukan', async () => {
    authRepository.findActivePenggunaByEmail.mockResolvedValue(null);
    await expect(service.login({ email: 'x@y.z', password: 'secret' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('seharusnya melempar UnauthorizedException ketika password tidak cocok', async () => {
    authRepository.findActivePenggunaByEmail.mockResolvedValue(sampleRow);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(
      service.login({ email: sampleRow.email, password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('seharusnya mengembalikan token dan publik pengguna ketika kredensial valid', async () => {
    authRepository.findActivePenggunaByEmail.mockResolvedValue(sampleRow);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const actual = await service.login({ email: sampleRow.email, password: 'ok' });
    expect(actual.accessToken).toBe('signed-jwt');
    expect(actual.refreshToken).toBe('signed-jwt');
    expect(actual.cookieMaxAgeMs).toBeGreaterThan(0);
    expect(actual.refreshCookieMaxAgeMs).toBeGreaterThan(actual.cookieMaxAgeMs);
    expect(actual.pengguna).toEqual({
      penggunaId: sampleRow.penggunaId,
      email: sampleRow.email,
      nama: sampleRow.nama,
      peran: sampleRow.peran,
      opdId: sampleRow.opdId,
      nip: sampleRow.nip,
      jabatan: sampleRow.jabatan,
      pangkat: sampleRow.pangkat,
      nohp: sampleRow.nohp,
      tte: { configured: false },
    });
    expect(authRepository.startSession).toHaveBeenCalledWith(sampleRow.penggunaId);
    expect(authRepository.storeRefreshToken).toHaveBeenCalledWith(
      sampleRow.penggunaId,
      'refresh-hash',
      expect.any(Date),
    );
    expect(jwtService.signAsync).toHaveBeenLastCalledWith(
      {
        sub: sampleRow.penggunaId,
        email: sampleRow.email,
        peran: sampleRow.peran,
        sesiTokenVersion: 1,
      },
      { expiresIn: 900 },
    );
  });

  it('seharusnya menandai status TTE configured ketika hash PIN tersedia', async () => {
    const updatedAt = new Date('2026-05-01T00:00:00.000Z');
    authRepository.findActivePenggunaById.mockResolvedValue({
      ...sampleRow,
      ttePinHash: 'pin-hash',
      updatedAt,
    });
    const actual = await service.getMe(sampleRow.penggunaId);
    expect(actual.tte).toEqual({
      configured: true,
      pinSetAt: updatedAt.toISOString(),
    });
  });

  it('seharusnya melempar NotFoundException ketika getMe tidak menemukan pengguna', async () => {
    authRepository.findActivePenggunaById.mockResolvedValue(null);
    await expect(service.getMe('missing-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seharusnya mengembalikan data publik pengguna ketika getMe berhasil', async () => {
    authRepository.findActivePenggunaById.mockResolvedValue(sampleRow);
    const actual = await service.getMe(sampleRow.penggunaId);
    expect(actual).toEqual({
      penggunaId: sampleRow.penggunaId,
      email: sampleRow.email,
      nama: sampleRow.nama,
      peran: sampleRow.peran,
      opdId: sampleRow.opdId,
      nip: sampleRow.nip,
      jabatan: sampleRow.jabatan,
      pangkat: sampleRow.pangkat,
      nohp: sampleRow.nohp,
      tte: { configured: false },
    });
  });

  it('seharusnya memperbarui nomor HP dan mengembalikan profil terbaru', async () => {
    const updatedRow = { ...sampleRow, nohp: '6281234567890' };
    authRepository.findActivePenggunaById.mockResolvedValue(sampleRow);
    authRepository.updateNohp.mockResolvedValue(updatedRow);

    const actual = await service.updateMyPhone(sampleRow.penggunaId, {
      nohp: updatedRow.nohp,
    });

    expect(authRepository.updateNohp).toHaveBeenCalledWith(sampleRow.penggunaId, updatedRow.nohp);
    expect(actual.nohp).toBe(updatedRow.nohp);
    expect(actual.penggunaId).toBe(sampleRow.penggunaId);
  });

  it('seharusnya tidak menulis database ketika nomor HP tidak berubah', async () => {
    authRepository.findActivePenggunaById.mockResolvedValue(sampleRow);

    const actual = await service.updateMyPhone(sampleRow.penggunaId, {
      nohp: sampleRow.nohp,
    });

    expect(authRepository.updateNohp).not.toHaveBeenCalled();
    expect(actual.nohp).toBe(sampleRow.nohp);
  });

  it('seharusnya menolak pembaruan nomor HP untuk pengguna yang tidak aktif', async () => {
    authRepository.findActivePenggunaById.mockResolvedValue(null);

    await expect(
      service.updateMyPhone('missing-id', { nohp: '6281234567890' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(authRepository.updateNohp).not.toHaveBeenCalled();
  });

  it('seharusnya memperbarui password ketika lama password valid', async () => {
    authRepository.findActivePenggunaById.mockResolvedValue(sampleRow);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
    await service.changePassword(sampleRow.penggunaId, {
      kataSandiLama: 'old-pass',
      kataSandiBaru: 'new-pass-8',
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('old-pass', sampleRow.kataSandi);
    expect(bcrypt.hash).toHaveBeenCalledWith('new-pass-8', 10);
    expect(authRepository.updateKataSandi).toHaveBeenCalledWith(sampleRow.penggunaId, 'new-hash');
  });

  it('seharusnya melempar UnauthorizedException ketika password lama salah saat changePassword', async () => {
    authRepository.findActivePenggunaById.mockResolvedValue(sampleRow);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(
      service.changePassword(sampleRow.penggunaId, {
        kataSandiLama: 'wrong',
        kataSandiBaru: 'new-pass-8',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authRepository.updateKataSandi).not.toHaveBeenCalled();
  });

  it('seharusnya merotasi refresh token dan menerbitkan access token baru', async () => {
    const rowWithRefresh: PenggunaAuthRecord = {
      ...sampleRow,
      refreshTokenHash: 'stored-refresh-hash',
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
    };
    authRepository.findActivePenggunaById.mockResolvedValue(rowWithRefresh);
    jwtService.verifyAsync.mockResolvedValue({
      sub: sampleRow.penggunaId,
      sesiTokenVersion: sampleRow.sesiTokenVersion,
      tokenType: 'refresh',
    });
    jwtService.signAsync
      .mockResolvedValueOnce('rotated-refresh-token')
      .mockResolvedValueOnce('new-access-token');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('rotated-refresh-hash');
    authRepository.startSession.mockResolvedValue({
      ...rowWithRefresh,
      sesiTokenVersion: sampleRow.sesiTokenVersion + 1,
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });
    authRepository.storeRefreshToken.mockResolvedValue({
      ...rowWithRefresh,
      sesiTokenVersion: sampleRow.sesiTokenVersion + 1,
      refreshTokenHash: 'rotated-refresh-hash',
    });
    const actual = await service.refreshSession('valid-refresh-token');
    expect(actual.accessToken).toBe('new-access-token');
    expect(actual.refreshToken).toBe('rotated-refresh-token');
    expect(actual.cookieMaxAgeMs).toBeGreaterThan(0);
    expect(authRepository.startSession).toHaveBeenCalledWith(sampleRow.penggunaId);
    expect(authRepository.storeRefreshToken).toHaveBeenCalledWith(
      sampleRow.penggunaId,
      'rotated-refresh-hash',
      expect.any(Date),
    );
    expect(jwtService.signAsync).toHaveBeenLastCalledWith(
      {
        sub: sampleRow.penggunaId,
        email: sampleRow.email,
        peran: sampleRow.peran,
        sesiTokenVersion: sampleRow.sesiTokenVersion + 1,
      },
      { expiresIn: 900 },
    );
  });

  it('seharusnya menolak refresh token yang tidak cocok dengan hash tersimpan', async () => {
    authRepository.findActivePenggunaById.mockResolvedValue({
      ...sampleRow,
      refreshTokenHash: 'stored-refresh-hash',
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    jwtService.verifyAsync.mockResolvedValue({
      sub: sampleRow.penggunaId,
      sesiTokenVersion: sampleRow.sesiTokenVersion,
      tokenType: 'refresh',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(service.refreshSession('replayed-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authRepository.storeRefreshToken).not.toHaveBeenCalled();
  });

  it('seharusnya menolak refresh token kosong atau hanya spasi', async () => {
    await expect(service.refreshSession(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refreshSession('   ')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(authRepository.findActivePenggunaById).not.toHaveBeenCalled();
  });

  it('seharusnya menolak payload refresh token dengan tipe token yang salah', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: sampleRow.penggunaId,
      sesiTokenVersion: sampleRow.sesiTokenVersion,
      tokenType: 'access',
    });
    await expect(service.refreshSession('access-token-disguised')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authRepository.findActivePenggunaById).not.toHaveBeenCalled();
  });

  it('seharusnya menolak refresh token ketika pengguna tidak ditemukan', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: sampleRow.penggunaId,
      sesiTokenVersion: sampleRow.sesiTokenVersion,
      tokenType: 'refresh',
    });
    authRepository.findActivePenggunaById.mockResolvedValue(null);
    await expect(service.refreshSession('valid-format-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(authRepository.startSession).not.toHaveBeenCalled();
  });

  it('seharusnya menolak refresh token ketika hash tersimpan kosong', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: sampleRow.penggunaId,
      sesiTokenVersion: sampleRow.sesiTokenVersion,
      tokenType: 'refresh',
    });
    authRepository.findActivePenggunaById.mockResolvedValue({
      ...sampleRow,
      refreshTokenHash: null,
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.refreshSession('valid-format-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('seharusnya menolak refresh token yang sudah kedaluwarsa di database', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: sampleRow.penggunaId,
      sesiTokenVersion: sampleRow.sesiTokenVersion,
      tokenType: 'refresh',
    });
    authRepository.findActivePenggunaById.mockResolvedValue({
      ...sampleRow,
      refreshTokenHash: 'stored-refresh-hash',
      refreshTokenExpiresAt: new Date(Date.now() - 1),
    });
    await expect(service.refreshSession('expired-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('seharusnya menolak refresh token dengan versi sesi lama', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: sampleRow.penggunaId,
      sesiTokenVersion: 1,
      tokenType: 'refresh',
    });
    authRepository.findActivePenggunaById.mockResolvedValue({
      ...sampleRow,
      sesiTokenVersion: 2,
      refreshTokenHash: 'stored-refresh-hash',
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.refreshSession('old-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('seharusnya revoke sesi saat logout dengan refresh token valid dan hash cocok', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: sampleRow.penggunaId,
      sesiTokenVersion: sampleRow.sesiTokenVersion,
      tokenType: 'refresh',
    });
    authRepository.findActivePenggunaById.mockResolvedValue({
      ...sampleRow,
      refreshTokenHash: 'stored-refresh-hash',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    await service.logout('valid-refresh-token');
    expect(authRepository.revokeSession).toHaveBeenCalledWith(sampleRow.penggunaId);
  });

  it('seharusnya tidak revoke sesi saat logout tanpa refresh token', async () => {
    await service.logout(undefined);
    await service.logout('   ');
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(authRepository.revokeSession).not.toHaveBeenCalled();
  });

  it('seharusnya tidak melempar error saat logout menerima token invalid', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));
    await expect(service.logout('invalid-refresh-token')).resolves.toBeUndefined();
    expect(authRepository.revokeSession).not.toHaveBeenCalled();
  });

  it('seharusnya tidak revoke sesi saat logout jika refresh token tidak cocok dengan hash', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: sampleRow.penggunaId,
      sesiTokenVersion: sampleRow.sesiTokenVersion,
      tokenType: 'refresh',
    });
    authRepository.findActivePenggunaById.mockResolvedValue({
      ...sampleRow,
      refreshTokenHash: 'stored-refresh-hash',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await service.logout('stale-refresh-token');
    expect(authRepository.revokeSession).not.toHaveBeenCalled();
  });

  it('seharusnya melempar NotFoundException ketika changePassword tidak menemukan pengguna', async () => {
    authRepository.findActivePenggunaById.mockResolvedValue(null);
    await expect(
      service.changePassword('missing-id', {
        kataSandiLama: 'old',
        kataSandiBaru: 'new-pass-8',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(authRepository.updateKataSandi).not.toHaveBeenCalled();
  });
});
