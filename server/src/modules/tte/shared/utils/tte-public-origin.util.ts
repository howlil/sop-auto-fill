import type { Request } from 'express';
import { normalizePublicVerifyBaseUrl } from './tte-verifikasi-qr.util';

/** Path halaman validasi pengesahan TTE di frontend (sama dengan client ROUTES.VALIDASI). */
export const VALIDASI_PENGESAHAN_PATH = '/validasi/pengesahan';

export function extractAppOriginFromRequest(req: Pick<Request, 'headers'>): string | null {
  const originHeader = req.headers.origin;
  if (typeof originHeader === 'string' && originHeader.trim() !== '') {
    return normalizePublicVerifyBaseUrl(originHeader);
  }
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.trim() !== '') {
    try {
      const url = new URL(referer);
      return normalizePublicVerifyBaseUrl(`${url.protocol}//${url.host}`);
    } catch {
      return null;
    }
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers['x-forwarded-host'] ?? req.headers.host;
  if (hostHeader === undefined || hostHeader === null) {
    return null;
  }
  const hostValue = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const protoValue = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const proto = (typeof protoValue === 'string' ? protoValue : 'https').split(',')[0].trim();
  const host = hostValue.split(',')[0].trim();
  if (host === '') {
    return null;
  }
  return normalizePublicVerifyBaseUrl(`${proto}://${host}`);
}

export function resolvePublicAppOrigin(params: {
  configOrigin?: string | undefined;
  requestOrigin?: string | null;
}): string | null {
  const fromConfig = normalizePublicVerifyBaseUrl(params.configOrigin);
  if (fromConfig !== null) {
    return fromConfig;
  }
  if (params.requestOrigin !== undefined && params.requestOrigin !== null) {
    return params.requestOrigin;
  }
  return null;
}

export function buildValidasiPengesahanBaseUrl(appOrigin: string): string {
  const origin = normalizePublicVerifyBaseUrl(appOrigin);
  if (origin === null) {
    throw new Error('Origin aplikasi tidak valid');
  }
  return `${origin}${VALIDASI_PENGESAHAN_PATH}`;
}
