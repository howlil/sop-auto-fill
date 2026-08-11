import { execSync } from 'child_process';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import { P12Signer } from '@signpdf/signer-p12';
import { SignPdf } from '@signpdf/signpdf';
import { verifyPdfWithP12 } from './pdf-signature-verification.util';

type PdfDocumentLike = {
  on(event: string, listener: (...args: unknown[]) => void): void;
  text(value: string): void;
  end(): void;
};

type PdfDocumentConstructor = new () => PdfDocumentLike;

// pdfkit adalah dependency transitif placeholder-plain; resolve dari package tersebut agar
// test memakai implementasi yang sama tanpa menambah dependency production baru.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require(
  require.resolve('pdfkit', { paths: [require.resolve('@signpdf/placeholder-plain')] }),
) as PdfDocumentConstructor;

describe('Pengujian util verifikasi tanda tangan PDF', () => {
  let p12Base64 = '';
  const passphrase = 'test-passphrase';

  beforeAll(() => {
    const output = execSync(`node scripts/generate-pdf-signing-cert.cjs ${passphrase}`, {
      encoding: 'utf8',
    });
    const line = output.split('\n').find((entry) => entry.startsWith('PDF_SIGNING_P12_BASE64='));
    if (!line) {
      throw new Error('Gagal menghasilkan sertifikat uji PDF.');
    }
    p12Base64 = line.split('=')[1];
  });

  it('seharusnya memverifikasi bertanda tangan PDF ketika chain dan digest cocok', async () => {
    const unsignedPdf = await createSamplePdf();
    const p12Buffer = Buffer.from(p12Base64, 'base64');
    const signedAt = new Date();
    const placeholder = plainAddPlaceholder({
      pdfBuffer: unsignedPdf,
      reason: 'Uji verifikasi',
      contactInfo: '',
      name: 'Penandatangan Uji',
      location: 'Indonesia',
      signingTime: signedAt,
      signatureLength: 32_000,
    });
    const signer = new P12Signer(p12Buffer, { passphrase, asn1StrictParsing: false });
    const signedPdf = await new SignPdf().sign(placeholder, signer, signedAt);
    const actual = verifyPdfWithP12(signedPdf, p12Buffer, passphrase, signedAt);
    const first = actual.signatures[0];

    expect(actual.hasSignatures).toBe(true);
    expect(first).toBeDefined();
    expect(first?.checks).toEqual({
      digestMatch: true,
      chainTrusted: true,
      certificatePeriodValid: true,
    });
    expect(first?.valid).toBe(true);
    expect(actual.allValid).toBe(true);
    expect(first?.signedAt).not.toBeNull();
  });

  it('seharusnya menolak tanpa tanda tangan PDF', async () => {
    const unsignedPdf = await createSamplePdf();
    const actual = verifyPdfWithP12(unsignedPdf, Buffer.from(p12Base64, 'base64'), passphrase);
    expect(actual.hasSignatures).toBe(false);
    expect(actual.allValid).toBe(false);
  });
});

function createSamplePdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: unknown) => {
      if (!Buffer.isBuffer(chunk)) {
        reject(new Error('pdfkit menghasilkan chunk non-Buffer'));
        return;
      }
      chunks.push(chunk);
    });
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.text('Dokumen uji verifikasi PDF');
    doc.end();
  });
}
