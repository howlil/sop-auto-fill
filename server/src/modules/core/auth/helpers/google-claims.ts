import { UnauthorizedException } from '@nestjs/common';

export interface GoogleIdTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export function assertValidGoogleClaims(
  raw: unknown,
  expectedAudience: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): GoogleIdTokenClaims {
  if (typeof raw !== 'object' || raw === null) {
    throw new UnauthorizedException('Google credential tidak valid');
  }

  const claims = raw as Record<string, unknown>;
  const iss = typeof claims.iss === 'string' ? claims.iss : '';
  const sub = typeof claims.sub === 'string' ? claims.sub : '';
  const aud = typeof claims.aud === 'string' ? claims.aud : '';
  const exp = typeof claims.exp === 'number' ? claims.exp : Number(claims.exp);

  if (
    !GOOGLE_ISSUERS.has(iss) ||
    sub.length === 0 ||
    aud !== expectedAudience ||
    !Number.isFinite(exp) ||
    exp <= nowSeconds
  ) {
    throw new UnauthorizedException('Google credential tidak valid');
  }

  return {
    iss,
    sub,
    aud,
    exp,
    ...(typeof claims.email === 'string' ? { email: claims.email } : {}),
    ...(typeof claims.email_verified === 'boolean'
      ? { email_verified: claims.email_verified }
      : {}),
    ...(typeof claims.name === 'string' ? { name: claims.name } : {}),
    ...(typeof claims.picture === 'string' ? { picture: claims.picture } : {}),
  };
}
