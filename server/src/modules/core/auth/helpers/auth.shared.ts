/**
 * Satu tempat untuk kontrak auth modul ini: tipe respons/JWT + nama/opsi cookie.
 * Menghindari banyak file kecil (`*-types`, `*-cookies`) agar folder `auth/` tetap mudah dibaca.
 */
import type { CookieOptions } from 'express';
import ms from 'ms';
import type { StringValue } from 'ms';
import type { PeranPengguna } from '../../../../generated/prisma';
import type { JwtAccessPayload } from '../../../../common/types/jwt-access-payload.type';

const DEFAULT_TIMESPAN = '15m' as const satisfies StringValue;
const DEFAULT_REFRESH_TIMESPAN = '7d' as const satisfies StringValue;
/** Cadangan jika `ms('15m')` gagal (tidak terduga). */
const FALLBACK_MAX_AGE_MS = 15 * 60 * 1000;
const FALLBACK_REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function durationMsFromString(timespan: string): number | null {
  try {
    const n = ms(timespan as StringValue);
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
      return null;
    }
    return n;
  } catch {
    return null;
  }
}

/**
 * Menghitung durasi token akses: `jsonwebtoken` menerima string timespan, tetapi parsing bisa gagal
 * bila nilai env aneh; memberi **expiresIn berupa detik (integer)** menghindari cabang string di library.
 */
export function resolveAccessTokenExpiry(raw: unknown): {
  expiresInSeconds: number;
  maxAgeMs: number;
} {
  return resolveTokenExpiry(raw, DEFAULT_TIMESPAN, FALLBACK_MAX_AGE_MS);
}

export function resolveRefreshTokenExpiry(raw: unknown): {
  expiresInSeconds: number;
  maxAgeMs: number;
} {
  return resolveTokenExpiry(raw, DEFAULT_REFRESH_TIMESPAN, FALLBACK_REFRESH_MAX_AGE_MS);
}

function resolveTokenExpiry(
  raw: unknown,
  defaultTimespan: StringValue,
  fallbackMaxAgeMs: number,
): {
  expiresInSeconds: number;
  maxAgeMs: number;
} {
  let maxAgeMs: number | null = null;
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
    maxAgeMs = raw * 1000;
  } else {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    const candidate = trimmed === '' ? defaultTimespan : trimmed;
    maxAgeMs = durationMsFromString(candidate);
    if (maxAgeMs === null) {
      maxAgeMs = durationMsFromString(defaultTimespan);
    }
    if (maxAgeMs === null) {
      maxAgeMs = fallbackMaxAgeMs;
    }
  }
  const expiresInSeconds = Math.max(1, Math.floor(maxAgeMs / 1000));
  return { expiresInSeconds, maxAgeMs };
}

export const ACCESS_TOKEN_COOKIE_NAME = 'access_token';
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

export function buildAccessTokenCookieOptions(
  maxAgeMs: number,
  isProduction: boolean,
): CookieOptions {
  if (isProduction) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: maxAgeMs,
      path: '/',
    };
  }
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: maxAgeMs,
    path: '/',
  };
}

/** Opsi `res.clearCookie` yang selaras dengan `buildAccessTokenCookieOptions` (tanpa `maxAge`). */
export function buildClearAccessTokenCookieOptions(
  isProduction: boolean,
): Pick<CookieOptions, 'path' | 'httpOnly' | 'sameSite' | 'secure'> {
  if (isProduction) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    };
  }
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  };
}

export function buildRefreshTokenCookieOptions(
  maxAgeMs: number,
  isProduction: boolean,
): CookieOptions {
  if (isProduction) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: maxAgeMs,
      path: '/',
    };
  }
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: maxAgeMs,
    path: '/',
  };
}

export function buildClearRefreshTokenCookieOptions(
  isProduction: boolean,
): Pick<CookieOptions, 'path' | 'httpOnly' | 'sameSite' | 'secure'> {
  if (isProduction) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    };
  }
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  };
}

export type JwtRefreshPayload = {
  readonly sub: string;
  readonly sesiTokenVersion: number;
  readonly tokenType: 'refresh';
};

export type PublicPenggunaTteStatus = {
  readonly configured: boolean;
  readonly pinSetAt?: string;
};

export type PublicPengguna = {
  readonly penggunaId: string;
  readonly email: string;
  readonly nama: string;
  readonly peran: PeranPengguna;
  readonly opdId: string;
  readonly nip: string;
  readonly jabatan: string;
  readonly pangkat: string;
  readonly nohp: string;
  readonly tte: PublicPenggunaTteStatus;
};

export type { JwtAccessPayload };
