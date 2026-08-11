import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

export type SecurityRateLimitPolicy = {
  readonly scope: string;
  readonly limit: number;
  readonly windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const MINUTE_MS = 60_000;

/**
 * Route policy sengaja kecil dan eksplisit: hanya endpoint yang rawan brute-force
 * atau mahal secara CPU yang dibatasi pada layer aplikasi.
 */
export function resolveSecurityRateLimitPolicy(
  method: string,
  path: string,
): SecurityRateLimitPolicy | null {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = path.replace(/\/+$/, '');

  if (normalizedMethod === 'POST' && /\/auth\/login$/.test(normalizedPath)) {
    return { scope: 'auth-login-ip', limit: 40, windowMs: 15 * MINUTE_MS };
  }
  if (normalizedMethod === 'POST' && /\/auth\/refresh$/.test(normalizedPath)) {
    return { scope: 'auth-refresh', limit: 60, windowMs: 15 * MINUTE_MS };
  }
  if (
    (normalizedMethod === 'PATCH' && /\/tte\/profil\/pin$/.test(normalizedPath)) ||
    (normalizedMethod === 'POST' &&
      (/\/tte\/profil\/(generate-p12|upload-p12)$/.test(normalizedPath) ||
        /\/tte\/tanda-tangani\//.test(normalizedPath) ||
        /\/tte\/pdf\/sign$/.test(normalizedPath)))
  ) {
    return { scope: 'tte-sensitive', limit: 20, windowMs: 15 * MINUTE_MS };
  }
  if (
    normalizedMethod === 'POST' &&
    /\/tte\/profil\/setup\/(generate|upload)$/.test(normalizedPath)
  ) {
    return { scope: 'tte-setup', limit: 10, windowMs: 60 * MINUTE_MS };
  }
  if (normalizedMethod === 'POST' && /\/tte\/public\/pdf\/verify$/.test(normalizedPath)) {
    return { scope: 'tte-public-pdf-verify', limit: 30, windowMs: MINUTE_MS };
  }

  return null;
}

@Injectable()
export class SecurityRateLimiterService {
  private readonly buckets = new Map<string, Bucket>();

  consume(policy: SecurityRateLimitPolicy, identifier: string, now = Date.now()): void {
    this.pruneExpired(now);
    const key = `${policy.scope}:${this.hashIdentifier(identifier)}`;
    const current = this.buckets.get(key);

    if (current === undefined || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + policy.windowMs });
      return;
    }

    if (current.count >= policy.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Terlalu banyak percobaan. Coba lagi setelah beberapa saat.',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
  }

  private pruneExpired(now: number): void {
    if (this.buckets.size < 1_000) {
      return;
    }
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  private hashIdentifier(identifier: string): string {
    return createHash('sha256').update(identifier).digest('hex');
  }
}
