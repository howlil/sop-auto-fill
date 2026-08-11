import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import { assertValidPdfBuffer } from '../../tte/shared/utils/pdf-signature-verification.util';

const SIGNATURE_QR_DRAW_SIZE = 54;
const SIGNATURE_QR_RENDER_SIZE = 192;
const SOP_PDF_PAGE_PADDING = 28;
const SIGNATURE_LABEL_COLUMN_RATIO = 0.45;
const SIGNATURE_RIGHT_COLUMN_RATIO = 0.55;
const SIGNATURE_VALUE_COLUMN_START_RATIO = 0.52;
const SIGNATURE_VALUE_COLUMN_RATIO = 0.48;
const SIGNATURE_METADATA_ROW_HEIGHT = 14;
const EFFECTIVE_DATE_ROW_INDEX = 3;
const EFFECTIVE_DATE_FONT_SIZE = 8;
const EFFECTIVE_DATE_CELL_INSET = 1.5;
const SIGNATURE_ROW_HEIGHT = 110;
const SIGNATURE_TABLE_HEIGHT = 376;
const SIGNATURE_ROLE_TEXT_HEIGHT = 8;
const SIGNATURE_ROLE_BOTTOM_MARGIN = 8;
const SIGNATURE_NAME_TOP_MARGIN = 8;
const SIGNATURE_CELL_PADDING = 2;

export function resolveSignatureQrPlacement(pageSize: { width: number; height: number }): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const contentWidth = pageSize.width - SOP_PDF_PAGE_PADDING * 2;
  const contentHeight = pageSize.height - SOP_PDF_PAGE_PADDING * 2;
  const tableTopFromPageTop =
    SOP_PDF_PAGE_PADDING + Math.max((contentHeight - SIGNATURE_TABLE_HEIGHT) / 2, 0);
  const signatureRowTopFromPageTop = tableTopFromPageTop + SIGNATURE_METADATA_ROW_HEIGHT * 4;
  const signatureValueCellX =
    SOP_PDF_PAGE_PADDING +
    contentWidth * SIGNATURE_LABEL_COLUMN_RATIO +
    contentWidth * SIGNATURE_RIGHT_COLUMN_RATIO * SIGNATURE_VALUE_COLUMN_START_RATIO;
  const signatureValueCellWidth =
    contentWidth * SIGNATURE_RIGHT_COLUMN_RATIO * SIGNATURE_VALUE_COLUMN_RATIO;
  const signatureContentHeight =
    SIGNATURE_ROLE_TEXT_HEIGHT +
    SIGNATURE_ROLE_BOTTOM_MARGIN +
    SIGNATURE_QR_DRAW_SIZE +
    SIGNATURE_NAME_TOP_MARGIN +
    10 +
    8;
  const signatureInnerTopOffset =
    SIGNATURE_CELL_PADDING +
    Math.max((SIGNATURE_ROW_HEIGHT - SIGNATURE_CELL_PADDING * 2 - signatureContentHeight) / 2, 0);
  const qrTopFromPageTop =
    signatureRowTopFromPageTop +
    signatureInnerTopOffset +
    SIGNATURE_ROLE_TEXT_HEIGHT +
    SIGNATURE_ROLE_BOTTOM_MARGIN;

  return {
    x: signatureValueCellX + (signatureValueCellWidth - SIGNATURE_QR_DRAW_SIZE) / 2,
    y: pageSize.height - qrTopFromPageTop - SIGNATURE_QR_DRAW_SIZE,
    width: SIGNATURE_QR_DRAW_SIZE,
    height: SIGNATURE_QR_DRAW_SIZE,
  };
}

/**
 * Area isi kolom TANGGAL EFEKTIF pada lembar header PDF SOP.
 *
 * Renderer React PDF membuat empat baris metadata setinggi 14pt pada panel kanan.
 * Server menutup isi lama (biasanya "-") di dalam border sel, kemudian menuliskan
 * tanggal pengesahan yang menjadi sumber kebenaran transaksi TTE.
 */
export function resolveEffectiveDatePlacement(pageSize: { width: number; height: number }): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const contentWidth = pageSize.width - SOP_PDF_PAGE_PADDING * 2;
  const contentHeight = pageSize.height - SOP_PDF_PAGE_PADDING * 2;
  const tableTopFromPageTop =
    SOP_PDF_PAGE_PADDING + Math.max((contentHeight - SIGNATURE_TABLE_HEIGHT) / 2, 0);
  const rightColumnX = SOP_PDF_PAGE_PADDING + contentWidth * SIGNATURE_LABEL_COLUMN_RATIO;
  const rightColumnWidth = contentWidth * SIGNATURE_RIGHT_COLUMN_RATIO;
  const valueCellX = rightColumnX + rightColumnWidth * SIGNATURE_VALUE_COLUMN_START_RATIO;
  const valueCellWidth = rightColumnWidth * SIGNATURE_VALUE_COLUMN_RATIO;
  const rowTopFromPageTop =
    tableTopFromPageTop + EFFECTIVE_DATE_ROW_INDEX * SIGNATURE_METADATA_ROW_HEIGHT;
  const rowBottom = pageSize.height - rowTopFromPageTop - SIGNATURE_METADATA_ROW_HEIGHT;

  return {
    x: valueCellX + EFFECTIVE_DATE_CELL_INSET,
    y: rowBottom + EFFECTIVE_DATE_CELL_INSET,
    width: valueCellWidth - EFFECTIVE_DATE_CELL_INSET * 2,
    height: SIGNATURE_METADATA_ROW_HEIGHT - EFFECTIVE_DATE_CELL_INSET * 2,
  };
}

export function formatTanggalEfektifWib(tanggalEfektif: Date): string {
  if (Number.isNaN(tanggalEfektif.getTime())) {
    throw new Error('Tanggal efektif tidak valid.');
  }
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(tanggalEfektif);
}

@Injectable()
export class SopOfficialPdfService {
  buildUnsignedOfficialPdf(detailSopId: string, pdfBase64: string): Buffer {
    try {
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      assertValidPdfBuffer(pdfBuffer);
      return pdfBuffer;
    } catch {
      throw new BadRequestException(
        `PDF hasil renderer kanvas untuk SOP ${detailSopId} tidak valid.`,
      );
    }
  }

  async stampPengesahanMetadata(params: {
    detailSopId: string;
    pdfBuffer: Buffer;
    qrPayload: string;
    tanggalEfektif: Date;
  }): Promise<Buffer> {
    try {
      assertValidPdfBuffer(params.pdfBuffer);
      const pdfDocument = await PDFDocument.load(params.pdfBuffer);
      const firstPage = pdfDocument.getPages()[0];
      if (firstPage === undefined) {
        throw new Error('PDF SOP tidak memiliki halaman.');
      }
      const qrPng = await QRCode.toBuffer(params.qrPayload, {
        type: 'png',
        width: SIGNATURE_QR_RENDER_SIZE,
        margin: 1,
      });
      const qrImage = await pdfDocument.embedPng(qrPng);
      const effectiveDatePlacement = resolveEffectiveDatePlacement({
        width: firstPage.getWidth(),
        height: firstPage.getHeight(),
      });
      const font = await pdfDocument.embedFont(StandardFonts.Helvetica);
      const effectiveDateText = formatTanggalEfektifWib(params.tanggalEfektif);

      // PDF kanvas dibuat sebelum transaksi final, sehingga nilai lama masih kosong.
      // Timpa hanya bagian dalam sel agar border tabel tidak ikut tertutup.
      firstPage.drawRectangle({
        ...effectiveDatePlacement,
        color: rgb(1, 1, 1),
      });
      firstPage.drawText(effectiveDateText, {
        x: effectiveDatePlacement.x + 2,
        y:
          effectiveDatePlacement.y +
          Math.max((effectiveDatePlacement.height - EFFECTIVE_DATE_FONT_SIZE) / 2, 0),
        size: EFFECTIVE_DATE_FONT_SIZE,
        font,
        color: rgb(0, 0, 0),
      });

      // Sel tanda tangan Kepala OPD memakai inset dari sudut kanan atas halaman.
      firstPage.drawImage(
        qrImage,
        resolveSignatureQrPlacement({
          width: firstPage.getWidth(),
          height: firstPage.getHeight(),
        }),
      );

      const stampedPdf = Buffer.from(await pdfDocument.save({ useObjectStreams: false }));
      assertValidPdfBuffer(stampedPdf);
      return stampedPdf;
    } catch {
      throw new BadRequestException(
        `Metadata pengesahan untuk SOP ${params.detailSopId} gagal disisipkan ke PDF resmi.`,
      );
    }
  }
}
