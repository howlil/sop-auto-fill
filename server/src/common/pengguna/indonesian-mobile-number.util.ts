import { BadRequestException } from '@nestjs/common';

export const INDONESIAN_MOBILE_CANONICAL_PATTERN = /^628\d{7,12}$/;
const INDONESIAN_MOBILE_LOCAL_PATTERN = /^08\d{7,12}$/;

/**
 * Menerima input digit `08...` atau `628...` dan menghasilkan format kanonik
 * E.164 tanpa tanda plus (`628...`) untuk disimpan di database.
 */
export function normalizeIndonesianMobileNumber(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (INDONESIAN_MOBILE_CANONICAL_PATTERN.test(trimmed)) {
    return trimmed;
  }
  if (INDONESIAN_MOBILE_LOCAL_PATTERN.test(trimmed)) {
    return `62${trimmed.slice(1)}`;
  }
  return null;
}

export function requireIndonesianMobileNumber(value: unknown): string {
  const normalized = normalizeIndonesianMobileNumber(value);
  if (normalized === null) {
    throw new BadRequestException(
      'Nomor HP harus memakai format 08... atau 628... dan hanya berisi 9-15 digit',
    );
  }
  return normalized;
}
