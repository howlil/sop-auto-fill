import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS, DEFAULT_PENGGUNA_PASSWORD } from '../auth/password.constants';
import { Prisma } from '../../generated/prisma';
export { requireIndonesianMobileNumber } from './indonesian-mobile-number.util';

export type StatusAktifDto = 'AKTIF' | 'NONAKTIF';

export function rethrowPrismaUniqueViolation(err: unknown): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new ConflictException('Email atau NIP sudah terdaftar');
  }
}

export function assertAtLeastOneUpdateField(
  fields: ReadonlyArray<unknown>,
  message = 'Minimal satu field harus diisi untuk pembaruan',
): void {
  if (!fields.some((f) => f !== undefined)) {
    throw new BadRequestException(message);
  }
}

export function resolveDeletedAtFromStatus(
  status: StatusAktifDto | undefined,
  current: Date | null,
): Date | null {
  if (status === 'NONAKTIF') {
    return new Date();
  }
  if (status === 'AKTIF') {
    return null;
  }
  return current;
}

export async function hashDefaultPassword(): Promise<string> {
  return bcrypt.hash(DEFAULT_PENGGUNA_PASSWORD, BCRYPT_SALT_ROUNDS);
}

export interface PenggunaUniquenessReader {
  existsEmailOtherThan(email: string, penggunaId: string): Promise<boolean>;
  existsNipOtherThan(nip: string, penggunaId: string): Promise<boolean>;
}

export async function assertEmailNipUniqueOnUpdate(
  repo: PenggunaUniquenessReader,
  penggunaId: string,
  existing: { email: string; nip: string },
  emailNext?: string,
  nipNext?: string,
): Promise<void> {
  if (emailNext !== undefined && emailNext !== existing.email) {
    if (await repo.existsEmailOtherThan(emailNext, penggunaId)) {
      throw new ConflictException('Email sudah digunakan pengguna lain');
    }
  }
  if (nipNext !== undefined && nipNext !== existing.nip) {
    if (await repo.existsNipOtherThan(nipNext, penggunaId)) {
      throw new ConflictException('NIP sudah digunakan pengguna lain');
    }
  }
}
