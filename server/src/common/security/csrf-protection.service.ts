import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE_NAME } from '../../modules/core/auth/helpers/auth.shared';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_HEADER_VALUE = '1';

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function readHeader(req: Pick<Request, 'headers'>, name: string): string | undefined {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.trim() : undefined;
}

function hasCookie(req: Pick<Request, 'cookies'>, name: string): boolean {
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) return false;
  const value = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0;
}

@Injectable()
export class CsrfProtectionService {
  private readonly enabled: boolean;
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('NODE_ENV', 'development') === 'production';
    const publicOrigin = config.get<string>('PUBLIC_APP_ORIGIN', '').trim();
    const configuredOrigins = config.get<string>('ALLOWED_ORIGINS', '');
    this.allowedOrigins = new Set(
      [publicOrigin, ...configuredOrigins.split(',')]
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map(normalizeOrigin)
        .filter((entry): entry is string => entry !== null),
    );
  }

  assertRequest(req: Pick<Request, 'method' | 'path' | 'headers' | 'cookies'>): void {
    if (!this.enabled || SAFE_METHODS.has(req.method.toUpperCase())) return;
    if (!this.requiresProtection(req)) return;

    const fetchSite = readHeader(req, 'sec-fetch-site')?.toLowerCase();
    if (fetchSite === 'cross-site') {
      throw new ForbiddenException('Permintaan lintas situs ditolak');
    }

    const originHeader = readHeader(req, 'origin');
    const origin = originHeader ? normalizeOrigin(originHeader) : null;
    if (origin === null || !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Origin permintaan tidak diizinkan');
    }

    if (readHeader(req, CSRF_HEADER_NAME) !== CSRF_HEADER_VALUE) {
      throw new ForbiddenException('Header proteksi CSRF tidak valid');
    }
  }

  private requiresProtection(req: Pick<Request, 'path' | 'cookies'>): boolean {
    if (/\/auth\/(google|logout)$/.test(req.path)) return true;
    return hasCookie(req, ACCESS_TOKEN_COOKIE_NAME);
  }
}
