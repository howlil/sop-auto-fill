import { HttpException } from '@nestjs/common';
import {
  SecurityRateLimiterService,
  resolveSecurityRateLimitPolicy,
} from './security-rate-limiter.service';

describe('SecurityRateLimiterService', () => {
  it('memilih policy untuk endpoint sensitif dan mengabaikan route biasa', () => {
    expect(resolveSecurityRateLimitPolicy('POST', '/api/v1/auth/login')?.scope).toBe(
      'auth-login-ip',
    );
    expect(resolveSecurityRateLimitPolicy('PATCH', '/api/v1/tte/profil/pin')?.scope).toBe(
      'tte-sensitive',
    );
    expect(resolveSecurityRateLimitPolicy('POST', '/api/v1/tte/public/pdf/verify')?.scope).toBe(
      'tte-public-pdf-verify',
    );
    expect(resolveSecurityRateLimitPolicy('GET', '/api/v1/auth/me')).toBeNull();
  });

  it('menolak request setelah limit tercapai dalam window yang sama', () => {
    const limiter = new SecurityRateLimiterService();
    const policy = { scope: 'test', limit: 2, windowMs: 60_000 };

    limiter.consume(policy, 'client-a', 1_000);
    limiter.consume(policy, 'client-a', 1_001);

    expect(() => limiter.consume(policy, 'client-a', 1_002)).toThrow(HttpException);
  });

  it('memisahkan bucket antar identifier', () => {
    const limiter = new SecurityRateLimiterService();
    const policy = { scope: 'test', limit: 1, windowMs: 60_000 };

    limiter.consume(policy, 'client-a', 1_000);
    expect(() => limiter.consume(policy, 'client-b', 1_001)).not.toThrow();
  });

  it('membuka bucket baru setelah window habis', () => {
    const limiter = new SecurityRateLimiterService();
    const policy = { scope: 'test', limit: 1, windowMs: 1_000 };

    limiter.consume(policy, 'client-a', 1_000);
    expect(() => limiter.consume(policy, 'client-a', 2_001)).not.toThrow();
  });
});
