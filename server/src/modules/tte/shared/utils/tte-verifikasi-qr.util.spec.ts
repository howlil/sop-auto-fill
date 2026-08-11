import {
  buildTteQrPayload,
  buildTteQrVerificationUrl,
  normalizePublicVerifyBaseUrl,
} from './tte-verifikasi-qr.util';

describe('Pengujian util verifikasi QR TTE', () => {
  describe('Pengujian normalizePublicVerifyBaseUrl', () => {
    it('seharusnya mengembalikan null untuk input kosong', () => {
      expect(normalizePublicVerifyBaseUrl(undefined)).toBeNull();
      expect(normalizePublicVerifyBaseUrl('')).toBeNull();
      expect(normalizePublicVerifyBaseUrl('   ')).toBeNull();
    });

    it('seharusnya menghapus garis miring di akhir URL', () => {
      expect(normalizePublicVerifyBaseUrl('https://app.example.com/')).toBe(
        'https://app.example.com',
      );
      expect(normalizePublicVerifyBaseUrl('https://app.example.com///')).toBe(
        'https://app.example.com',
      );
    });
  });

  describe('Pengujian buildTteQrVerificationUrl', () => {
    it('seharusnya menambahkan path dan query hash', () => {
      const actualUrl = buildTteQrVerificationUrl({
        baseUrl: 'https://app.example.com',
        dokumenTteId: 'doc-uuid',
        hashDokumen: 'abc/def',
      });
      expect(actualUrl).toContain('/tte/verifikasi-dokumen/doc-uuid');
      expect(actualUrl).toContain('h=');
      expect(actualUrl).toContain(encodeURIComponent('abc/def'));
    });
  });

  describe('Pengujian buildTteQrPayload', () => {
    it('seharusnya menggunakan URL sebagai payload ketika base URL tersedia', () => {
      const actual = buildTteQrPayload({
        publicVerifyBaseUrl: 'https://portal.example',
        dokumenTteId: 'id-1',
        hashDokumen: 'hash-1',
      });
      expect(actual.qrVerificationUrl).not.toBeNull();
      expect(actual.qrPayload).toBe(actual.qrVerificationUrl);
    });

    it('seharusnya menggunakan payload JSON ketika base URL tidak tersedia', () => {
      const actual = buildTteQrPayload({
        publicVerifyBaseUrl: undefined,
        dokumenTteId: 'id-2',
        hashDokumen: 'hash-2',
      });
      expect(actual.qrVerificationUrl).toBeNull();
      expect(JSON.parse(actual.qrPayload)).toEqual({
        t: 'tte-verify-v1',
        dokumenTteId: 'id-2',
        hashDokumen: 'hash-2',
      });
    });
  });
});
