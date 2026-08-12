const MAX_PDF_BYTES = 20 * 1024 * 1024;
const PDF_HEADER = Buffer.from('%PDF-');

/** Validasi minimum untuk payload PDF hasil renderer SOP. */
export function assertValidPdfBuffer(pdfBuffer: Buffer): void {
  if (pdfBuffer.byteLength === 0 || pdfBuffer.byteLength > MAX_PDF_BYTES) {
    throw new Error('Ukuran PDF tidak valid.');
  }
  if (!pdfBuffer.subarray(0, PDF_HEADER.byteLength).equals(PDF_HEADER)) {
    throw new Error('Payload bukan file PDF valid.');
  }
}
