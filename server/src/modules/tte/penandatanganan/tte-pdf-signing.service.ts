import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import { P12Signer } from '@signpdf/signer-p12';
import { SignPdf } from '@signpdf/signpdf';
import { PDFDocument } from 'pdf-lib';
import type { JwtAccessPayload } from '../../../common';
import {
  PDF_BASE64_MAX_LENGTH,
  PDF_BINARY_MAX_BYTES,
} from '../../../common/http/request-body-limits';
import { JenisDokumenTte } from '../../../generated/prisma';

import { SignPdfDto } from '../shared/dto/sign-pdf.dto';
import { VerifyPdfDto } from '../shared/dto/verify-pdf.dto';
import {
  loadTrustedCertificatesFromP12,
  mapCertificateToResponse,
  type PdfCertificateResponse,
} from '../shared/utils/pdf-signing-certificate.util';

export type { PdfCertificateResponse } from '../shared/utils/pdf-signing-certificate.util';
import {
  assertValidPdfBuffer,
  buildPdfTteSigningReason,
  extractPdfSignatureFields,
  verifyPdfSignaturesGeneric,
  type PdfSignatureVerificationEntry,
  type VerifyPdfSignaturesResult,
} from '../shared/utils/pdf-signature-verification.util';
import {
  decryptP12Passphrase,
  encryptP12Passphrase,
  isLegacyP12PassphraseCiphertext,
} from '../shared/utils/tte-crypto.util';
import { TteRepository, type PdfSignatureMetadataInput } from '../shared/repository/tte.repository';

const DEFAULT_SIGNATURE_LENGTH = 32_000;

export type SignPdfResponse = {
  readonly signed: boolean;
  readonly signedPdfBase64: string;
  readonly sha256SignedPdf: string;
  readonly signatureFormat: 'PKCS7_DETACHED' | 'UNSIGNED_DISABLED' | 'UNSIGNED_NOT_REQUIRED';
  readonly certificate: PdfCertificateResponse | null;
};

export type OfficialPdfSigningResult = {
  readonly signedPdf: Buffer;
  readonly sha256SignedPdf: string;
  readonly signatureFormat: 'PKCS7_DETACHED';
  readonly certificate: PdfCertificateResponse;
  readonly riwayatMetadata: PdfSignatureMetadataInput;
};

export type PdfSigningStatusResponse = {
  readonly enabled: boolean;
  readonly trustedCaSubject: string | null;
  readonly trustedSignerSubject: string | null;
  readonly verificationPath: string;
  readonly configError?: string;
};

export type VerifyPdfResponse = {
  readonly pdfSigningEnabled: boolean;
  readonly trustedCaSubject: string | null;
  readonly hasSignatures: boolean;
  readonly allValid: boolean;
  readonly signatures: readonly PdfSignatureVerificationEntryWithTteMatch[];
  readonly disclaimer: string;
};

export type PdfSignatureTteMatch = {
  readonly matched: boolean;
  readonly reason: string;
  readonly dokumenTteId?: string;
  readonly userId?: string;
  readonly peran?: string;
  readonly jenisDokumen?: string;
  readonly nomorDokumen?: string;
  readonly judulDokumen?: string;
  readonly ditandatanganiPada?: string;
};

export type PdfSignatureVerificationEntryWithTteMatch = PdfSignatureVerificationEntry & {
  readonly tteMatch: PdfSignatureTteMatch;
};

type PdfSigningConfig = {
  readonly p12Base64?: string;
  readonly passphrase: string;
  readonly reason: string;
  readonly location: string;
  readonly contactInfo: string;
};

const PDF_VERIFICATION_DISCLAIMER =
  'Verifikasi ini memakai CA internal SOPFlow. Untuk TTE tersertifikasi nasional, gunakan portal resmi Komdigi atau BSrE.';

@Injectable()
export class TtePdfSigningService {
  private readonly logger = new Logger(TtePdfSigningService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly repository: TteRepository,
  ) {}

  getPdfSigningStatus(): PdfSigningStatusResponse {
    return {
      enabled: this.isPdfSigningEnabled(),
      trustedCaSubject: null,
      trustedSignerSubject: null,
      verificationPath: '/validasi/pdf',
    };
  }

  async verifyPdf(dto: VerifyPdfDto): Promise<VerifyPdfResponse> {
    const pdfBuffer = this.decodePdf(dto.pdfBase64);
    let verification: VerifyPdfSignaturesResult;
    try {
      verification = verifyPdfSignaturesGeneric(pdfBuffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memverifikasi PDF.';
      throw new BadRequestException(message);
    }
    const signatures = await Promise.all(
      verification.signatures.map((entry) => this.attachTteMatch(entry)),
    );
    return {
      // Verifikasi tetap tersedia walaupun pembuatan signature baru dimatikan.
      pdfSigningEnabled: this.isPdfSigningEnabled(),
      trustedCaSubject: null,
      hasSignatures: verification.hasSignatures,
      allValid: verification.allValid && signatures.every((entry) => entry.tteMatch.matched),
      signatures,
      disclaimer: PDF_VERIFICATION_DISCLAIMER,
    };
  }

  async signPdf(user: JwtAccessPayload, dto: SignPdfDto): Promise<SignPdfResponse> {
    if (dto.userId !== user.sub) {
      throw new ForbiddenException('PDF hanya bisa ditandatangani oleh pemilik riwayat TTE.');
    }
    const pdfBuffer = this.decodePdf(dto.pdfBase64);
    const riwayat = await this.repository.findRiwayatForPdfSigning(dto.userId, dto.dokumenTteId);
    if (riwayat === null) {
      throw new NotFoundException('Riwayat tanda tangan dokumen tidak ditemukan.');
    }
    if (riwayat.dokumenTte.jenisDokumen !== dto.jenisDokumen) {
      throw new BadRequestException('Jenis dokumen tidak sesuai dengan riwayat TTE.');
    }
    if (dto.jenisDokumen !== JenisDokumenTte.SOP_BERLAKU) {
      return this.buildSkippedCaResponse(pdfBuffer);
    }
    if (!this.isPdfSigningEnabled()) {
      return this.buildDisabledResponse(pdfBuffer);
    }

    const kredensial = await this.repository.findKredensial(dto.userId);
    if (!kredensial || !kredensial.p12Base64 || !kredensial.p12PassphraseEncrypted) {
      throw new BadRequestException(
        'Sertifikat TTE personal belum diatur. Silakan buat di halaman Profil.',
      );
    }

    const p12Passphrase = await this.decryptAndUpgradePassphrase({
      userId: dto.userId,
      pin: dto.pin,
      p12Base64: kredensial.p12Base64,
      encryptedPassphrase: kredensial.p12PassphraseEncrypted,
    });

    const config = this.getConfig();
    const signed = await this.applyPkcs7Signature(
      pdfBuffer,
      { ...config, p12Base64: kredensial.p12Base64, passphrase: p12Passphrase },
      {
        name: riwayat.user.nama,
        reason: buildPdfTteSigningReason(config.reason, {
          dokumenTteId: dto.dokumenTteId,
          userId: dto.userId,
          jenisDokumen: String(dto.jenisDokumen),
        }),
      },
    );
    await this.repository.updateRiwayatPdfSignatureMetadata({
      userId: dto.userId,
      dokumenTteId: dto.dokumenTteId,
      metadata: signed.riwayatMetadata,
    });
    return signed.response;
  }

  async signOfficialSopPdfWithUserCertificate(params: {
    userId: string;
    pin: string;
    dokumenTteId: string;
    pdfBuffer: Buffer;
    signerName: string;
  }): Promise<OfficialPdfSigningResult> {
    if (!this.isPdfSigningEnabled()) {
      throw new ConflictException('Penandatanganan PDF kriptografis sedang dinonaktifkan.');
    }

    const kredensial = await this.repository.findKredensial(params.userId);
    if (!kredensial || !kredensial.p12Base64 || !kredensial.p12PassphraseEncrypted) {
      throw new BadRequestException(
        'Sertifikat TTE personal belum diatur. Silakan buat di halaman Profil.',
      );
    }

    const p12Passphrase = await this.decryptAndUpgradePassphrase({
      userId: params.userId,
      pin: params.pin,
      p12Base64: kredensial.p12Base64,
      encryptedPassphrase: kredensial.p12PassphraseEncrypted,
    });

    const config = this.getConfig();
    const signed = await this.applyPkcs7Signature(
      params.pdfBuffer,
      { ...config, p12Base64: kredensial.p12Base64, passphrase: p12Passphrase },
      {
        name: params.signerName,
        reason: buildPdfTteSigningReason(config.reason, {
          dokumenTteId: params.dokumenTteId,
          userId: params.userId,
          jenisDokumen: String(JenisDokumenTte.SOP_BERLAKU),
        }),
      },
    );
    if (!signed.response.signed || signed.response.certificate === null) {
      throw new InternalServerErrorException('Gagal menandatangani PDF SOP resmi.');
    }
    return {
      signedPdf: Buffer.from(signed.response.signedPdfBase64, 'base64'),
      sha256SignedPdf: signed.response.sha256SignedPdf,
      signatureFormat: 'PKCS7_DETACHED',
      certificate: signed.response.certificate,
      riwayatMetadata: signed.riwayatMetadata,
    };
  }

  private async buildPlaceholderPdf(
    pdfBuffer: Buffer,
    config: PdfSigningConfig,
    placeholder: { name: string; reason: string },
    signingTime: Date,
  ): Promise<Buffer> {
    const placeholderInput = {
      reason: placeholder.reason,
      contactInfo: config.contactInfo,
      name: placeholder.name,
      location: config.location,
      signingTime,
      signatureLength: DEFAULT_SIGNATURE_LENGTH,
    };
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
      pdflibAddPlaceholder({ pdfDoc, ...placeholderInput });
      return Buffer.from(
        await pdfDoc.save({
          useObjectStreams: false,
          addDefaultPage: false,
          updateFieldAppearances: false,
        }),
      );
    } catch (pdflibError) {
      const detail =
        pdflibError instanceof Error ? pdflibError.message : 'format PDF tidak dikenali';
      this.logger.warn(`Placeholder pdf-lib gagal (${detail}); mencoba plainAddPlaceholder.`);
      return plainAddPlaceholder({ pdfBuffer, ...placeholderInput });
    }
  }

  private async applyPkcs7Signature(
    pdfBuffer: Buffer,
    config: PdfSigningConfig & { p12Base64: string },
    placeholder: { name: string; reason: string },
  ): Promise<{ response: SignPdfResponse; riwayatMetadata: PdfSignatureMetadataInput }> {
    const p12Buffer = Buffer.from(config.p12Base64, 'base64');
    const signingTime = new Date();
    try {
      const trusted = loadTrustedCertificatesFromP12(p12Buffer, config.passphrase);
      const certificate = mapCertificateToResponse(trusted.signingCertificate);
      const placeholderPdf = await this.buildPlaceholderPdf(
        pdfBuffer,
        config,
        placeholder,
        signingTime,
      );
      const signer = new P12Signer(p12Buffer, {
        passphrase: config.passphrase,
        asn1StrictParsing: false,
      });
      const signedPdf = await new SignPdf().sign(placeholderPdf, signer, signingTime);
      const signatureFields = extractPdfSignatureFields(signedPdf);
      const pkcs7Signature = signatureFields[signatureFields.length - 1]?.pkcs7Buffer;
      const signatureValue =
        pkcs7Signature === undefined ? this.sha256Hex(signedPdf) : this.sha256Hex(pkcs7Signature);
      return {
        response: {
          signed: true,
          signedPdfBase64: signedPdf.toString('base64'),
          sha256SignedPdf: this.sha256Hex(signedPdf),
          signatureFormat: 'PKCS7_DETACHED',
          certificate,
        },
        riwayatMetadata: {
          signatureValue: `sha256:${signatureValue}`,
          signatureAlgorithm: 'SHA256withRSA',
          signatureFormat: 'PKCS7_DETACHED',
          certSerialNumber: certificate.serialNumber,
          certIssuer: certificate.issuer,
          certSubject: certificate.subject,
          certFingerprint: certificate.fingerprint,
          certValidFrom: new Date(certificate.validFrom),
          certValidTo: new Date(certificate.validTo),
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? `Gagal menandatangani PDF: ${error.message}`
          : 'Gagal menandatangani PDF.',
      );
    }
  }

  private async decryptAndUpgradePassphrase(params: {
    userId: string;
    pin: string;
    p12Base64: string;
    encryptedPassphrase: string;
  }): Promise<string> {
    let passphrase: string;
    try {
      passphrase = decryptP12Passphrase(params.encryptedPassphrase, params.pin);
    } catch {
      throw new ForbiddenException('PIN TTE salah atau gagal mendekripsi sertifikat.');
    }

    if (isLegacyP12PassphraseCiphertext(params.encryptedPassphrase)) {
      try {
        await this.repository.updateKredensialP12({
          userId: params.userId,
          p12Base64: params.p12Base64,
          p12PassphraseEncrypted: encryptP12Passphrase(passphrase, params.pin),
        });
        this.logger.log(`Ciphertext P12 legacy berhasil di-upgrade userId=${params.userId}`);
      } catch (error) {
        this.logger.warn(
          `Ciphertext P12 legacy belum dapat di-upgrade userId=${params.userId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return passphrase;
  }

  private isPdfSigningEnabled(): boolean {
    return this.configService.get<boolean>('PDF_SIGNING_ENABLED', true);
  }

  private getConfig(): PdfSigningConfig {
    const p12Raw = this.configService.get<string>('PDF_SIGNING_P12_BASE64');
    return {
      p12Base64: typeof p12Raw === 'string' && p12Raw.trim() !== '' ? p12Raw.trim() : undefined,
      passphrase: this.configService.get<string>('PDF_SIGNING_P12_PASSPHRASE', ''),
      reason: this.configService.get<string>('PDF_SIGNING_REASON', 'Pengesahan dokumen SOP'),
      location: this.configService.get<string>('PDF_SIGNING_LOCATION', 'Indonesia'),
      contactInfo: this.configService.get<string>('PDF_SIGNING_CONTACT', ''),
    };
  }

  private decodePdf(pdfBase64: string): Buffer {
    if (pdfBase64.length > PDF_BASE64_MAX_LENGTH) {
      throw new BadRequestException('Ukuran PDF melebihi batas unggah.');
    }
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    if (pdfBuffer.byteLength > PDF_BINARY_MAX_BYTES) {
      throw new BadRequestException('Ukuran PDF melebihi batas unggah.');
    }
    try {
      assertValidPdfBuffer(pdfBuffer);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Ukuran PDF tidak valid.',
      );
    }
    return pdfBuffer;
  }

  private buildSkippedCaResponse(pdfBuffer: Buffer): SignPdfResponse {
    return {
      signed: false,
      signedPdfBase64: pdfBuffer.toString('base64'),
      sha256SignedPdf: this.sha256Hex(pdfBuffer),
      signatureFormat: 'UNSIGNED_NOT_REQUIRED',
      certificate: null,
    };
  }

  private buildDisabledResponse(pdfBuffer: Buffer): SignPdfResponse {
    return {
      signed: false,
      signedPdfBase64: pdfBuffer.toString('base64'),
      sha256SignedPdf: this.sha256Hex(pdfBuffer),
      signatureFormat: 'UNSIGNED_DISABLED',
      certificate: null,
    };
  }

  private sha256Hex(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private async attachTteMatch(
    entry: PdfSignatureVerificationEntry,
  ): Promise<PdfSignatureVerificationEntryWithTteMatch> {
    const binding = entry.binding;
    if (binding === null) {
      return {
        ...entry,
        tteMatch: {
          matched: false,
          reason:
            'Signature PDF valid kriptografis, tetapi tidak memuat binding dokumen TTE aplikasi.',
        },
      };
    }
    const row = await this.repository.findRiwayatByPdfSignatureBinding({
      userId: binding.userId,
      dokumenTteId: binding.dokumenTteId,
    });
    if (row === null) {
      return {
        ...entry,
        tteMatch: {
          matched: false,
          reason: 'Binding signature tidak ditemukan pada riwayat TTE aplikasi.',
          dokumenTteId: binding.dokumenTteId,
          userId: binding.userId,
          jenisDokumen: binding.jenisDokumen,
        },
      };
    }
    if (String(row.dokumenTte.jenisDokumen) !== binding.jenisDokumen) {
      return {
        ...entry,
        tteMatch: {
          matched: false,
          reason: 'Jenis dokumen pada signature PDF tidak cocok dengan riwayat TTE aplikasi.',
          dokumenTteId: row.dokumenTteId,
          userId: row.userId,
          peran: String(row.peran),
          jenisDokumen: String(row.dokumenTte.jenisDokumen),
        },
      };
    }
    if (
      row.signatureValue === null ||
      row.certFingerprint === null ||
      row.certSerialNumber === null
    ) {
      return {
        ...entry,
        tteMatch: {
          matched: false,
          reason: 'Riwayat TTE ditemukan, tetapi metadata signature PDF belum tersimpan.',
          dokumenTteId: row.dokumenTteId,
          userId: row.userId,
          peran: String(row.peran),
          jenisDokumen: String(row.dokumenTte.jenisDokumen),
          nomorDokumen: row.dokumenTte.nomorDokumen,
          judulDokumen: row.dokumenTte.judulDokumen,
          ditandatanganiPada: row.ditandatanganiPada.toISOString(),
        },
      };
    }
    const certMatches =
      row.certFingerprint === entry.certificate.fingerprint &&
      row.certSerialNumber === entry.certificate.serialNumber;
    const signatureValueMatches = row.signatureValue === entry.signatureValue;
    return {
      ...entry,
      tteMatch: {
        matched: entry.valid && certMatches && signatureValueMatches,
        reason:
          entry.valid && certMatches && signatureValueMatches
            ? 'Signature PDF cocok dengan riwayat TTE aplikasi, signature value, dan sertifikat yang tersimpan.'
            : 'Signature PDF tidak cocok dengan signature value/fingerprint/serial sertifikat pada riwayat TTE aplikasi.',
        dokumenTteId: row.dokumenTteId,
        userId: row.userId,
        peran: String(row.peran),
        jenisDokumen: String(row.dokumenTte.jenisDokumen),
        nomorDokumen: row.dokumenTte.nomorDokumen,
        judulDokumen: row.dokumenTte.judulDokumen,
        ditandatanganiPada: row.ditandatanganiPada.toISOString(),
      },
    };
  }
}
