import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { Pengguna } from '../../../generated/prisma';

/** Baris pengguna untuk autentikasi (tanpa relasi). */
export type PenggunaAuthRecord = Pengguna;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mencari pengguna aktif berdasarkan email.
   */
  async findActivePenggunaByEmail(email: string): Promise<PenggunaAuthRecord | null> {
    return this.prisma.pengguna.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  /**
   * Mencari pengguna aktif berdasarkan ID.
   */
  async findActivePenggunaById(penggunaId: string): Promise<PenggunaAuthRecord | null> {
    return this.prisma.pengguna.findFirst({
      where: {
        penggunaId,
        deletedAt: null,
      },
    });
  }

  /** Memperbarui hash kata sandi pengguna aktif. */
  async updateKataSandi(penggunaId: string, kataSandiHash: string): Promise<void> {
    await this.prisma.pengguna.update({
      where: { penggunaId },
      data: {
        kataSandi: kataSandiHash,
        passwordChangedAt: new Date(),
        sesiTokenVersion: { increment: 1 },
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
  }

  /** Memperbarui nomor HP tanpa merotasi atau membatalkan sesi pengguna. */
  async updateNohp(penggunaId: string, nohp: string): Promise<PenggunaAuthRecord> {
    return this.prisma.pengguna.update({
      where: { penggunaId },
      data: { nohp },
    });
  }

  async startSession(penggunaId: string): Promise<PenggunaAuthRecord> {
    return this.prisma.pengguna.update({
      where: { penggunaId },
      data: {
        sesiTokenVersion: { increment: 1 },
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
  }

  async storeRefreshToken(
    penggunaId: string,
    refreshTokenHash: string,
    refreshTokenExpiresAt: Date,
  ): Promise<PenggunaAuthRecord> {
    return this.prisma.pengguna.update({
      where: { penggunaId },
      data: {
        refreshTokenHash,
        refreshTokenExpiresAt,
      },
    });
  }

  async revokeSession(penggunaId: string): Promise<void> {
    await this.prisma.pengguna.update({
      where: { penggunaId },
      data: {
        sesiTokenVersion: { increment: 1 },
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
  }
}
