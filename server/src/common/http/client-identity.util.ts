import type { Request } from 'express';

export function getClientIp(request: Request): string {
  const rawIp = request.ip ?? request.socket.remoteAddress ?? 'unknown';
  const ip = rawIp.trim();
  if (ip.startsWith('::ffff:')) {
    return ip.slice('::ffff:'.length);
  }
  return ip === '' ? 'unknown' : ip;
}

export function getClientUserAgent(request: Request): string | null {
  const raw = request.get('user-agent') ?? '';
  const value = raw.trim();
  return value === '' ? null : value.slice(0, 512);
}
