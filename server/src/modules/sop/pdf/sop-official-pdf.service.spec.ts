import { BadRequestException } from '@nestjs/common';
import { PDFDocument, PDFPage } from 'pdf-lib';
import {
  formatTanggalEfektifWib,
  resolveEffectiveDatePlacement,
  resolveSignatureQrPlacement,
  SopOfficialPdfService,
} from './sop-official-pdf.service';

describe('SopOfficialPdfService', () => {
  const service = new SopOfficialPdfService();

  it('menggunakan PDF hasil renderer kanvas sebagai artefak resmi', () => {
    const pdf = Buffer.from('%PDF-1.7\nrenderer-kanvas');

    expect(service.buildUnsignedOfficialPdf('detail-1', pdf.toString('base64'))).toEqual(pdf);
  });

  it('menolak payload yang bukan PDF', () => {
    expect(() =>
      service.buildUnsignedOfficialPdf('detail-1', Buffer.from('bukan-pdf').toString('base64')),
    ).toThrow(BadRequestException);
  });

  it('menyisipkan tanggal efektif dan QR tanda tangan ke halaman pertama PDF resmi', async () => {
    const pdfDocument = await PDFDocument.create();
    pdfDocument.addPage([841.89, 595.28]);
    const unsignedPdf = Buffer.from(await pdfDocument.save());
    const drawTextSpy = jest.spyOn(PDFPage.prototype, 'drawText');

    const stampedPdf = await service.stampPengesahanMetadata({
      detailSopId: 'detail-1',
      pdfBuffer: unsignedPdf,
      qrPayload: 'https://app.test/validasi/pengesahan/doc-1/user-1',
      tanggalEfektif: new Date('2026-07-31T17:00:00.000Z'),
    });

    expect(stampedPdf.byteLength).toBeGreaterThan(unsignedPdf.byteLength);
    expect(drawTextSpy).toHaveBeenCalledWith('01/08/2026', expect.objectContaining({ size: 8 }));
    await expect(PDFDocument.load(stampedPdf)).resolves.toBeDefined();
    drawTextSpy.mockRestore();
  });

  it('memformat tanggal efektif berdasarkan hari kalender WIB', () => {
    expect(formatTanggalEfektifWib(new Date('2026-07-31T17:00:00.000Z'))).toBe('01/08/2026');
  });

  it('menjaga area tanggal efektif tetap di dalam sel nilai metadata', () => {
    const placement = resolveEffectiveDatePlacement({ width: 841.89, height: 595.28 });

    expect(placement.x).toBeCloseTo(607.91504, 5);
    expect(placement.y).toBeCloseTo(431.14, 5);
    expect(placement.width).toBeCloseTo(204.475, 3);
    expect(placement.height).toBe(11);
  });

  it('menjaga posisi QR di tengah sel tanda tangan Kepala OPD', () => {
    const a4Landscape = resolveSignatureQrPlacement({ width: 841.89, height: 595.28 });
    expect(a4Landscape.x).toBeCloseTo(683.15252, 5);
    expect(a4Landscape.y).toBeCloseTo(352.64, 5);
    expect(a4Landscape.width).toBe(54);
    expect(a4Landscape.height).toBe(54);

    const largerPage = resolveSignatureQrPlacement({ width: 900, height: 700 });
    expect(largerPage.x).toBeCloseTo(733.592, 5);
    expect(largerPage.y).toBeCloseTo(405, 5);
    expect(largerPage.width).toBe(54);
    expect(largerPage.height).toBe(54);
  });

  it('menolak (melempar BadRequestException) jika PDF buffer rusak/corrupt (Bad Case)', async () => {
    const corruptPdf = Buffer.from('%PDF-1.7\nCorrupt-buffer-tanpa-eof');

    await expect(
      service.stampPengesahanMetadata({
        detailSopId: 'detail-3',
        pdfBuffer: corruptPdf,
        qrPayload: 'https://app.test/validasi',
        tanggalEfektif: new Date('2026-07-31T17:00:00.000Z'),
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
