import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE_NAME } from '../../modules/core/auth/helpers/auth.shared';
import { CsrfProtectionService } from './csrf-protection.service';

function config(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue),
  } as unknown as ConfigService;
}

function request(
  overrides: Partial<Pick<Request, 'method' | 'path' | 'headers' | 'cookies'>> = {},
): Pick<Request, 'method' | 'path' | 'headers' | 'cookies'> {
  return {
    method: 'POST',
    path: '/api/v1/auth/login',
    headers: {
      origin: 'https://sop.example.test',
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': '1',
    },
    cookies: {},
    ...overrides,
  } as Pick<Request, 'method' | 'path' | 'headers' | 'cookies'>;
}

describe('CsrfProtectionService', () => {
  it('tidak memblokir development', () => {
    const service = new CsrfProtectionService(
      config({ NODE_ENV: 'development', PUBLIC_APP_ORIGIN: 'https://sop.example.test' }),
    );
    expect(() =>
      service.assertRequest(request({ headers: { origin: 'https://evil.example' } })),
    ).not.toThrow();
  });

  it('menerima login production dari origin resmi dengan custom header', () => {
    const service = new CsrfProtectionService(
      config({ NODE_ENV: 'production', PUBLIC_APP_ORIGIN: 'https://sop.example.test' }),
    );
    expect(() => service.assertRequest(request())).not.toThrow();
  });

  it('menolak request cookie-auth dari cross-site', () => {
    const service = new CsrfProtectionService(
      config({ NODE_ENV: 'production', PUBLIC_APP_ORIGIN: 'https://sop.example.test' }),
    );
    expect(() =>
      service.assertRequest(
        request({
          path: '/api/v1/tte/profil/pin',
          headers: {
            origin: 'https://evil.example',
            'sec-fetch-site': 'cross-site',
            'x-csrf-token': '1',
          },
          cookies: { [ACCESS_TOKEN_COOKIE_NAME]: 'cookie-value' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('menolak origin yang tidak ada dalam allow-list', () => {
    const service = new CsrfProtectionService(
      config({ NODE_ENV: 'production', PUBLIC_APP_ORIGIN: 'https://sop.example.test' }),
    );
    expect(() =>
      service.assertRequest(
        request({
          headers: {
            origin: 'https://evil.example',
            'sec-fetch-site': 'same-site',
            'x-csrf-token': '1',
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('menolak request protected tanpa custom header', () => {
    const service = new CsrfProtectionService(
      config({ NODE_ENV: 'production', PUBLIC_APP_ORIGIN: 'https://sop.example.test' }),
    );
    expect(() =>
      service.assertRequest(
        request({
          headers: {
            origin: 'https://sop.example.test',
            'sec-fetch-site': 'same-origin',
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('melewatkan public POST tanpa cookie karena bukan CSRF target', () => {
    const service = new CsrfProtectionService(
      config({ NODE_ENV: 'production', PUBLIC_APP_ORIGIN: 'https://sop.example.test' }),
    );
    expect(() =>
      service.assertRequest(
        request({
          path: '/api/v1/tte/public/pdf/verify',
          headers: {},
          cookies: {},
        }),
      ),
    ).not.toThrow();
  });
});
