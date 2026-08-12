import type { CookieOptions } from 'express';
import ms from 'ms';
import type { StringValue } from 'ms';
import type { JwtAccessPayload } from '../../../../common/types/jwt-access-payload.type';

const DEFAULT_TIMESPAN = '7d' as const satisfies StringValue;
const FALLBACK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const ACCESS_TOKEN_COOKIE_NAME = 'access_token';

export type PublicUser = {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl: string | null;
};

export function resolveAccessTokenExpiry(raw: unknown): {
  expiresInSeconds: number;
  maxAgeMs: number;
} {
  let maxAgeMs = FALLBACK_MAX_AGE_MS;
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
    maxAgeMs = raw * 1000;
  } else {
    const candidate =
      typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : DEFAULT_TIMESPAN;
    try {
      const parsed = ms(candidate as StringValue);
      if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0) {
        maxAgeMs = parsed;
      }
    } catch {
      maxAgeMs = FALLBACK_MAX_AGE_MS;
    }
  }
  return {
    expiresInSeconds: Math.max(1, Math.floor(maxAgeMs / 1000)),
    maxAgeMs,
  };
}

export function buildAccessTokenCookieOptions(
  maxAgeMs: number,
  isProduction: boolean,
): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: maxAgeMs,
    path: '/',
  };
}

export function buildClearAccessTokenCookieOptions(
  isProduction: boolean,
): Pick<CookieOptions, 'path' | 'httpOnly' | 'sameSite' | 'secure'> {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  };
}

export type { JwtAccessPayload };
