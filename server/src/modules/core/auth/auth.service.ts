import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { BCRYPT_SALT_ROUNDS } from '../../../common/auth/password.constants';
import { AuthRepository, type PenggunaAuthRecord } from './auth.repository';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { UpdateMyPhoneDto } from './dto/update-my-phone.dto';
import {
  resolveRefreshTokenExpiry,
  resolveAccessTokenExpiry,
  type JwtRefreshPayload,
  type JwtAccessPayload,
  type PublicPengguna,
} from './helpers/auth.shared';

const REFRESH_TOKEN_HASH_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Autentikasi email/kata sandi; menghasilkan JWT untuk cookie dan data pengguna publik.
   */
  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    pengguna: PublicPengguna;
    cookieMaxAgeMs: number;
    refreshCookieMaxAgeMs: number;
  }> {
    const row = await this.authRepository.findActivePenggunaByEmail(dto.email);
    if (row === null) {
      throw new UnauthorizedException('Email atau kata sandi tidak valid');
    }
    const isMatch = await bcrypt.compare(dto.password, row.kataSandi);
    if (!isMatch) {
      throw new UnauthorizedException('Email atau kata sandi tidak valid');
    }
    const sessionRow = await this.authRepository.startSession(row.penggunaId);
    const refreshSession = await this.createRefreshToken(
      sessionRow.penggunaId,
      sessionRow.sesiTokenVersion,
    );
    const storedSessionRow = await this.authRepository.storeRefreshToken(
      sessionRow.penggunaId,
      refreshSession.refreshTokenHash,
      refreshSession.refreshTokenExpiresAt,
    );
    const { accessToken, cookieMaxAgeMs } = await this.signAccessToken(storedSessionRow);
    return {
      accessToken,
      refreshToken: refreshSession.refreshToken,
      pengguna: this.mapToPublicPengguna(row),
      cookieMaxAgeMs,
      refreshCookieMaxAgeMs: refreshSession.refreshCookieMaxAgeMs,
    };
  }

  /**
   * Mengambil data publik pengguna yang sedang masuk (berdasarkan klaim JWT).
   */
  async getMe(penggunaId: string): Promise<PublicPengguna> {
    const row = await this.authRepository.findActivePenggunaById(penggunaId);
    if (row === null) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }
    return this.mapToPublicPengguna(row);
  }

  /** Memperbarui nomor HP milik pengguna yang sedang login. */
  async updateMyPhone(penggunaId: string, dto: UpdateMyPhoneDto): Promise<PublicPengguna> {
    const row = await this.authRepository.findActivePenggunaById(penggunaId);
    if (row === null) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }
    if (row.nohp === dto.nohp) {
      return this.mapToPublicPengguna(row);
    }
    const updated = await this.authRepository.updateNohp(penggunaId, dto.nohp);
    return this.mapToPublicPengguna(updated);
  }

  /**
   * Ubah kata sandi pengguna yang sedang login; wajib kata sandi lama valid.
   */
  async changePassword(penggunaId: string, dto: ChangePasswordDto): Promise<void> {
    const row = await this.authRepository.findActivePenggunaById(penggunaId);
    if (row === null) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }
    const isMatch = await bcrypt.compare(dto.kataSandiLama, row.kataSandi);
    if (!isMatch) {
      throw new UnauthorizedException('Kata sandi lama tidak valid');
    }
    const kataSandiHash = await bcrypt.hash(dto.kataSandiBaru, BCRYPT_SALT_ROUNDS);
    await this.authRepository.updateKataSandi(penggunaId, kataSandiHash);
  }

  async refreshSession(refreshToken: string | undefined): Promise<{
    accessToken: string;
    refreshToken: string;
    cookieMaxAgeMs: number;
    refreshCookieMaxAgeMs: number;
  }> {
    if (refreshToken === undefined || refreshToken.trim() === '') {
      throw new UnauthorizedException('Refresh token tidak valid');
    }
    const payload = await this.verifyRefreshToken(refreshToken);
    const row = await this.authRepository.findActivePenggunaById(payload.sub);
    if (
      row === null ||
      row.refreshTokenHash === null ||
      row.refreshTokenExpiresAt === null ||
      row.refreshTokenExpiresAt.getTime() <= Date.now() ||
      row.sesiTokenVersion !== payload.sesiTokenVersion
    ) {
      throw new UnauthorizedException('Refresh token tidak valid');
    }
    const isMatch = await bcrypt.compare(refreshToken, row.refreshTokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Refresh token tidak valid');
    }
    const sessionRow = await this.authRepository.startSession(row.penggunaId);
    const refreshSession = await this.createRefreshToken(
      sessionRow.penggunaId,
      sessionRow.sesiTokenVersion,
    );
    const storedSessionRow = await this.authRepository.storeRefreshToken(
      sessionRow.penggunaId,
      refreshSession.refreshTokenHash,
      refreshSession.refreshTokenExpiresAt,
    );
    const { accessToken, cookieMaxAgeMs } = await this.signAccessToken(storedSessionRow);
    return {
      accessToken,
      refreshToken: refreshSession.refreshToken,
      cookieMaxAgeMs,
      refreshCookieMaxAgeMs: refreshSession.refreshCookieMaxAgeMs,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken === undefined || refreshToken.trim() === '') {
      return;
    }
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      const row = await this.authRepository.findActivePenggunaById(payload.sub);
      if (row?.refreshTokenHash === null || row?.refreshTokenHash === undefined) {
        return;
      }
      if (await bcrypt.compare(refreshToken, row.refreshTokenHash)) {
        await this.authRepository.revokeSession(row.penggunaId);
      }
    } catch {
      return;
    }
  }

  private mapToPublicPengguna(row: PenggunaAuthRecord): PublicPengguna {
    const configured = row.ttePinHash !== null;
    return {
      penggunaId: row.penggunaId,
      email: row.email,
      nama: row.nama,
      peran: row.peran,
      opdId: row.opdId,
      nip: row.nip,
      jabatan: row.jabatan,
      pangkat: row.pangkat,
      nohp: row.nohp,
      tte: {
        configured,
        ...(configured ? { pinSetAt: row.updatedAt.toISOString() } : {}),
      },
    };
  }

  private async signAccessToken(row: PenggunaAuthRecord): Promise<{
    accessToken: string;
    cookieMaxAgeMs: number;
  }> {
    const payload: JwtAccessPayload = {
      sub: row.penggunaId,
      email: row.email,
      peran: row.peran,
      sesiTokenVersion: row.sesiTokenVersion,
    };
    const { expiresInSeconds, maxAgeMs } = resolveAccessTokenExpiry(
      this.config.get('JWT_EXPIRATION'),
    );
    const signOptions: JwtSignOptions = { expiresIn: expiresInSeconds };
    const accessToken = await this.jwtService.signAsync({ ...payload }, signOptions);
    return { accessToken, cookieMaxAgeMs: maxAgeMs };
  }

  private async createRefreshToken(
    penggunaId: string,
    sesiTokenVersion: number,
  ): Promise<{
    refreshToken: string;
    refreshTokenHash: string;
    refreshTokenExpiresAt: Date;
    refreshCookieMaxAgeMs: number;
  }> {
    const { expiresInSeconds, maxAgeMs } = resolveRefreshTokenExpiry(
      this.config.get('JWT_REFRESH_EXPIRATION'),
    );
    const payload: JwtRefreshPayload = {
      sub: penggunaId,
      sesiTokenVersion,
      tokenType: 'refresh',
    };
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: expiresInSeconds,
      jwtid: randomUUID(),
    });
    const refreshTokenHash = await bcrypt.hash(refreshToken, REFRESH_TOKEN_HASH_ROUNDS);
    return {
      refreshToken,
      refreshTokenHash,
      refreshTokenExpiresAt: new Date(Date.now() + maxAgeMs),
      refreshCookieMaxAgeMs: maxAgeMs,
    };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<JwtRefreshPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: this.getRefreshSecret(),
      });
      if (
        payload.tokenType !== 'refresh' ||
        typeof payload.sub !== 'string' ||
        typeof payload.sesiTokenVersion !== 'number'
      ) {
        throw new UnauthorizedException('Refresh token tidak valid');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token tidak valid');
    }
  }

  private getRefreshSecret(): string {
    return (
      this.config.get<string>('JWT_REFRESH_SECRET') ?? this.config.get<string>('JWT_SECRET') ?? ''
    );
  }
}
