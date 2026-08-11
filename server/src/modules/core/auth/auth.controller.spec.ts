import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { PeranPengguna } from '../../../generated/prisma';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  type JwtAccessPayload,
} from './helpers/auth.shared';

describe('Pengujian AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<
      AuthService,
      'login' | 'getMe' | 'updateMyPhone' | 'refreshSession' | 'logout' | 'changePassword'
    >
  >;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let response: jest.Mocked<Pick<Response, 'cookie' | 'clearCookie'>>;

  const pengguna = {
    penggunaId: 'p-1',
    email: 'tester@example.test',
    nama: 'Tester',
    peran: PeranPengguna.PENYUSUN,
    opdId: 'opd-1',
    nip: '198001012009011001',
    jabatan: 'Staf',
    pangkat: 'III/a',
    nohp: '08123456789',
    tte: { configured: false },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authService = {
      login: jest.fn(),
      getMe: jest.fn(),
      updateMyPhone: jest.fn(),
      refreshSession: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue('development'),
    };
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    controller = new AuthController(
      authService as unknown as AuthService,
      configService as unknown as ConfigService,
    );
  });

  it('seharusnya set cookie access dan refresh ketika login berhasil', async () => {
    authService.login.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      pengguna,
      cookieMaxAgeMs: 900_000,
      refreshCookieMaxAgeMs: 604_800_000,
    });
    const actual = await controller.login(
      { email: pengguna.email, password: 'password' },
      response as unknown as Response,
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      1,
      ACCESS_TOKEN_COOKIE_NAME,
      'access-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'none', maxAge: 900_000 }),
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      2,
      REFRESH_TOKEN_COOKIE_NAME,
      'refresh-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'none', maxAge: 604_800_000 }),
    );
    expect(actual).toEqual({
      message: 'Login berhasil',
      success: true,
      data: pengguna,
    });
  });

  it('seharusnya menggunakan opsi cookie production saat NODE_ENV production', async () => {
    configService.get.mockReturnValue('production');
    authService.login.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      pengguna,
      cookieMaxAgeMs: 900_000,
      refreshCookieMaxAgeMs: 604_800_000,
    });
    await controller.login(
      { email: pengguna.email, password: 'password' },
      response as unknown as Response,
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      1,
      ACCESS_TOKEN_COOKIE_NAME,
      'access-token',
      expect.objectContaining({ secure: true, sameSite: 'lax' }),
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      2,
      REFRESH_TOKEN_COOKIE_NAME,
      'refresh-token',
      expect.objectContaining({ secure: true, sameSite: 'lax' }),
    );
  });

  it('seharusnya refresh sesi dari cookie refresh token dan set ulang dua cookie', async () => {
    authService.refreshSession.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      cookieMaxAgeMs: 900_000,
      refreshCookieMaxAgeMs: 604_800_000,
    });
    const request = {
      cookies: { [REFRESH_TOKEN_COOKIE_NAME]: 'old-refresh-token' },
    } as unknown as Request;
    const actual = await controller.refresh(request, response as unknown as Response);
    expect(authService.refreshSession).toHaveBeenCalledWith('old-refresh-token');
    expect(response.cookie).toHaveBeenCalledTimes(2);
    expect(response.cookie).toHaveBeenNthCalledWith(
      1,
      ACCESS_TOKEN_COOKIE_NAME,
      'new-access-token',
      expect.any(Object),
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      2,
      REFRESH_TOKEN_COOKIE_NAME,
      'new-refresh-token',
      expect.any(Object),
    );
    expect(actual).toEqual({
      message: 'Sesi diperbarui',
      success: true,
      data: { success: true },
    });
  });

  it('seharusnya logout dengan refresh token dari cookie dan membersihkan dua cookie', async () => {
    authService.logout.mockResolvedValue(undefined);
    const request = {
      cookies: { [REFRESH_TOKEN_COOKIE_NAME]: 'refresh-token' },
    } as unknown as Request;
    const actual = await controller.logout(request, response as unknown as Response);
    expect(authService.logout).toHaveBeenCalledWith('refresh-token');
    expect(response.clearCookie).toHaveBeenNthCalledWith(
      1,
      ACCESS_TOKEN_COOKIE_NAME,
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(response.clearCookie).toHaveBeenNthCalledWith(
      2,
      REFRESH_TOKEN_COOKIE_NAME,
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(actual).toEqual({
      message: 'Logout berhasil',
      success: true,
      data: { success: true },
    });
  });

  it('seharusnya mengambil profil dari sub pengguna di request', async () => {
    authService.getMe.mockResolvedValue(pengguna);
    const actual = await controller.me({
      user: {
        sub: pengguna.penggunaId,
        email: pengguna.email,
        peran: pengguna.peran,
        sesiTokenVersion: 1,
      },
    } as Request & { user: JwtAccessPayload });
    expect(authService.getMe).toHaveBeenCalledWith(pengguna.penggunaId);
    expect(actual.data).toBe(pengguna);
  });

  it('seharusnya memperbarui nomor HP akun dari sub JWT, bukan dari payload ID', async () => {
    const updated = { ...pengguna, nohp: '6281234567890' };
    authService.updateMyPhone.mockResolvedValue(updated);
    const request = {
      user: {
        sub: pengguna.penggunaId,
        email: pengguna.email,
        peran: pengguna.peran,
        sesiTokenVersion: 1,
      },
    } as Request & { user: JwtAccessPayload };

    const actual = await controller.updateMyPhone(request, { nohp: updated.nohp });

    expect(authService.updateMyPhone).toHaveBeenCalledWith(pengguna.penggunaId, {
      nohp: updated.nohp,
    });
    expect(actual).toEqual({
      message: 'Nomor HP berhasil diperbarui',
      success: true,
      data: updated,
    });
  });
});
