import { UnauthorizedException } from '@nestjs/common';
import { assertValidGoogleClaims } from './google-claims';

describe('assertValidGoogleClaims', () => {
  const nowSeconds = 1_786_502_400; // 2026-08-12T00:00:00Z

  it('accepts a valid Google ID token payload for the configured client', () => {
    const claims = assertValidGoogleClaims(
      {
        iss: 'https://accounts.google.com',
        sub: 'google-user-123',
        aud: 'client.apps.googleusercontent.com',
        exp: nowSeconds + 3600,
        email: 'user@example.com',
        email_verified: true,
        name: 'Example User',
        picture: 'https://example.com/avatar.png',
      },
      'client.apps.googleusercontent.com',
      nowSeconds,
    );

    expect(claims.sub).toBe('google-user-123');
    expect(claims.email).toBe('user@example.com');
    expect(claims.name).toBe('Example User');
  });

  it('rejects a token issued for another OAuth client', () => {
    expect(() =>
      assertValidGoogleClaims(
        {
          iss: 'https://accounts.google.com',
          sub: 'google-user-123',
          aud: 'attacker.apps.googleusercontent.com',
          exp: nowSeconds + 3600,
          email: 'user@example.com',
          email_verified: true,
        },
        'client.apps.googleusercontent.com',
        nowSeconds,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects an expired token', () => {
    expect(() =>
      assertValidGoogleClaims(
        {
          iss: 'accounts.google.com',
          sub: 'google-user-123',
          aud: 'client.apps.googleusercontent.com',
          exp: nowSeconds - 1,
          email: 'user@example.com',
          email_verified: true,
        },
        'client.apps.googleusercontent.com',
        nowSeconds,
      ),
    ).toThrow(UnauthorizedException);
  });
});
