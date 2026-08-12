import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, verify as verifySignature, type JsonWebKey } from 'node:crypto';
import {
  assertValidGoogleClaims,
  type GoogleIdTokenClaims,
} from './helpers/google-claims';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

type GoogleJwk = JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
};

@Injectable()
export class GoogleIdTokenVerifierService {
  private cachedKeys = new Map<string, GoogleJwk>();
  private cacheExpiresAtMs = 0;

  constructor(private readonly config: ConfigService) {}

  async verify(credential: string): Promise<GoogleIdTokenClaims> {
    const parts = credential.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Google credential tidak valid');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = this.decodeJson<JwtHeader>(encodedHeader);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length === 0) {
      throw new UnauthorizedException('Google credential tidak valid');
    }

    const jwk = await this.getKey(header.kid);
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    const isValidSignature = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      publicKey,
      Buffer.from(encodedSignature, 'base64url'),
    );
    if (!isValidSignature) {
      throw new UnauthorizedException('Google credential tidak valid');
    }

    const payload = this.decodeJson<unknown>(encodedPayload);
    return assertValidGoogleClaims(
      payload,
      this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    );
  }

  private decodeJson<T>(encoded: string): T {
    try {
      return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
    } catch {
      throw new UnauthorizedException('Google credential tidak valid');
    }
  }

  private async getKey(kid: string): Promise<GoogleJwk> {
    if (Date.now() >= this.cacheExpiresAtMs || !this.cachedKeys.has(kid)) {
      await this.refreshKeys();
    }
    const key = this.cachedKeys.get(kid);
    if (key === undefined) {
      throw new UnauthorizedException('Google credential tidak valid');
    }
    return key;
  }

  private async refreshKeys(): Promise<void> {
    let response: Response;
    try {
      response = await fetch(GOOGLE_JWKS_URL, {
        headers: { accept: 'application/json' },
      });
    } catch {
      throw new UnauthorizedException('Google credential tidak dapat diverifikasi');
    }
    if (!response.ok) {
      throw new UnauthorizedException('Google credential tidak dapat diverifikasi');
    }

    const body = (await response.json()) as { keys?: GoogleJwk[] };
    if (!Array.isArray(body.keys) || body.keys.length === 0) {
      throw new UnauthorizedException('Google credential tidak dapat diverifikasi');
    }

    this.cachedKeys = new Map(
      body.keys
        .filter((key) => typeof key.kid === 'string' && key.kid.length > 0)
        .map((key) => [key.kid as string, key]),
    );

    const cacheControl = response.headers.get('cache-control') ?? '';
    const match = /max-age=(\d+)/i.exec(cacheControl);
    const maxAgeSeconds = match === null ? 300 : Number(match[1]);
    this.cacheExpiresAtMs = Date.now() + Math.max(60, maxAgeSeconds) * 1000;
  }
}
