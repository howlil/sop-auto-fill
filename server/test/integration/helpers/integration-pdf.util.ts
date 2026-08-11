import { execSync } from 'child_process';
import { resolve } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require(
  require.resolve('pdfkit', { paths: [require.resolve('@signpdf/placeholder-plain')] }),
);

/** Origin aplikasi untuk simulasi URL QR di PDF unduhan (mirror client `window.location.origin`). */
export const PUBLIC_APP_ORIGIN = 'https://integration-test.local';

const SERVER_ROOT = resolve(__dirname, '..', '..', '..');

/**
 * Path relatif halaman validasi pengesahan — sama dengan [`getValidasiPengesahanUrl`](client/src/lib/tte/url.ts).
 */
export function buildValidasiPengesahanPath(dokumenTteId: string, userId: string): string {
  return `/validasi/pengesahan/${dokumenTteId}/${userId}`;
}

export function buildValidasiPengesahanUrl(
  origin: string,
  dokumenTteId: string,
  userId: string,
): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}${buildValidasiPengesahanPath(dokumenTteId, userId)}`;
}

export function createMinimalPdfBuffer(text = 'Dokumen uji integration PDF TTE'): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument() as {
      on(event: string, listener: (...args: unknown[]) => void): void;
      text(value: string): void;
      end(): void;
    };
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.text(text);
    doc.end();
  });
}

export type TestPdfSigningEnv = {
  readonly p12Base64: string;
  readonly passphrase: string;
};

/** Menghasilkan sertifikat uji dan mengaktifkan env penandatanganan PDF untuk integration test. */
export function applyTestPdfSigningEnv(passphrase = 'test-passphrase'): TestPdfSigningEnv {
  const output = execSync(`node scripts/generate-pdf-signing-cert.cjs ${passphrase}`, {
    cwd: SERVER_ROOT,
    encoding: 'utf8',
  });
  const line = output.split('\n').find((entry) => entry.startsWith('PDF_SIGNING_P12_BASE64='));
  if (!line) {
    throw new Error('Gagal menghasilkan sertifikat uji PDF untuk integration test.');
  }
  const p12Base64 = line.split('=')[1];
  process.env.PDF_SIGNING_ENABLED = 'true';
  process.env.PDF_SIGNING_P12_BASE64 = p12Base64;
  process.env.PDF_SIGNING_P12_PASSPHRASE = passphrase;
  process.env.PDF_SIGNING_REASON = 'Uji integration';
  process.env.PDF_SIGNING_LOCATION = 'Indonesia';
  process.env.PDF_SIGNING_CONTACT = '';
  return { p12Base64, passphrase };
}
