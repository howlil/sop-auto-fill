/**
 * Payload QR verifikasi dokumen TTE **tidak perlu kolom DB terpisah**:
 * URL atau JSON dapat dibentuk dari `dokumenTteId` + `hashDokumen` yang sudah ada di `DokumenTte`.
 *
 * Jika basis URL publik tersedia (deteksi Origin atau `PUBLIC_APP_ORIGIN`), QR berisi URL verifikasi.
 * Jika tidak, QR berisi JSON ringkas agar klien tetap bisa render QR tanpa basis URL.
 */

export interface TteQrPayloadResult {
  readonly qrVerificationUrl: string | null;
  /** String yang di-encode ke QR (sama dengan URL publik bila dikonfigurasi). */
  readonly qrPayload: string;
}

export function normalizePublicVerifyBaseUrl(raw: string | undefined): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  return trimmed.replace(/\/+$/, '');
}

export function buildTteQrVerificationUrl(params: {
  baseUrl: string;
  dokumenTteId: string;
  hashDokumen: string;
}): string {
  const base = normalizePublicVerifyBaseUrl(params.baseUrl);
  if (base === null) {
    throw new Error('Basis URL verifikasi tidak boleh kosong');
  }
  const query = new URLSearchParams({ h: params.hashDokumen });
  return `${base}/tte/verifikasi-dokumen/${params.dokumenTteId}?${query.toString()}`;
}

export function buildTteQrPayload(params: {
  publicVerifyBaseUrl: string | undefined;
  dokumenTteId: string;
  hashDokumen: string;
}): TteQrPayloadResult {
  const base = normalizePublicVerifyBaseUrl(params.publicVerifyBaseUrl);
  if (base !== null) {
    const qrVerificationUrl = buildTteQrVerificationUrl({
      baseUrl: base,
      dokumenTteId: params.dokumenTteId,
      hashDokumen: params.hashDokumen,
    });
    return { qrVerificationUrl, qrPayload: qrVerificationUrl };
  }
  const qrPayload = JSON.stringify({
    t: 'tte-verify-v1',
    dokumenTteId: params.dokumenTteId,
    hashDokumen: params.hashDokumen,
  });
  return { qrVerificationUrl: null, qrPayload };
}
