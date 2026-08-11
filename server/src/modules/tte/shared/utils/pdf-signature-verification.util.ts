import { createHash } from 'crypto';
import forge from 'node-forge';
import {
  extractMessageDigestFromPkcs7,
  loadTrustedCertificatesFromP12,
  mapCertificateToResponse,
  type TrustedPdfCertificates,
} from './pdf-signing-certificate.util';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const PDF_HEADER = Buffer.from('%PDF-');

export type PdfEmbeddedSignatureField = {
  readonly byteRange: readonly [number, number, number, number];
  readonly pkcs7Buffer: Buffer;
  readonly reason: string | null;
  readonly name: string | null;
};

export type PdfTteSignatureBinding = {
  readonly dokumenTteId: string;
  readonly userId: string;
  readonly jenisDokumen: string;
};

export type PdfSignatureVerificationEntry = {
  readonly index: number;
  readonly valid: boolean;
  readonly reason: string;
  readonly signatureValue: string;
  readonly signerSubject: string;
  readonly signerIssuer: string;
  readonly signedAt: string | null;
  readonly binding: PdfTteSignatureBinding | null;
  readonly certificate: {
    readonly validFrom: string;
    readonly validTo: string;
    readonly fingerprint: string;
    readonly serialNumber: string;
  };
  readonly checks: {
    readonly digestMatch: boolean;
    readonly chainTrusted: boolean;
    readonly certificatePeriodValid: boolean;
  };
};

export type VerifyPdfSignaturesResult = {
  readonly hasSignatures: boolean;
  readonly allValid: boolean;
  readonly signatures: readonly PdfSignatureVerificationEntry[];
};

export function assertValidPdfBuffer(pdfBuffer: Buffer): void {
  if (pdfBuffer.byteLength === 0 || pdfBuffer.byteLength > MAX_PDF_BYTES) {
    throw new Error('Ukuran PDF tidak valid.');
  }
  if (!pdfBuffer.subarray(0, 5).equals(PDF_HEADER)) {
    throw new Error('Payload bukan file PDF valid.');
  }
}

export function extractPdfSignatureFields(pdfBuffer: Buffer): PdfEmbeddedSignatureField[] {
  const pdfText = pdfBuffer.toString('latin1');
  const byteRangeMatches = [
    ...pdfText.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g),
  ];
  const contentsMatches = [...pdfText.matchAll(/\/Contents\s*<([0-9A-Fa-f\s]*?)>/g)];
  const signatureCount = Math.min(byteRangeMatches.length, contentsMatches.length);
  const signatures: PdfEmbeddedSignatureField[] = [];
  for (let index = 0; index < signatureCount; index += 1) {
    const byteRangeMatch = byteRangeMatches[index];
    const contentsMatch = contentsMatches[index];
    if (!byteRangeMatch || !contentsMatch) {
      continue;
    }
    const byteRange: [number, number, number, number] = [
      Number(byteRangeMatch[1]),
      Number(byteRangeMatch[2]),
      Number(byteRangeMatch[3]),
      Number(byteRangeMatch[4]),
    ];
    const pkcs7Buffer = trimPkcs7Buffer(Buffer.from(contentsMatch[1].replace(/\s/g, ''), 'hex'));
    if (pkcs7Buffer.byteLength === 0) {
      continue;
    }
    const signatureDictionary = extractSignatureDictionary(pdfText, byteRangeMatch.index ?? 0);
    signatures.push({
      byteRange,
      pkcs7Buffer,
      reason: extractPdfLiteralString(signatureDictionary, 'Reason'),
      name: extractPdfLiteralString(signatureDictionary, 'Name'),
    });
  }
  return signatures;
}

export function buildPdfTteSigningReason(
  baseReason: string,
  binding: PdfTteSignatureBinding,
): string {
  return [
    baseReason.trim() || 'Pengesahan dokumen SOP',
    `SI-SOP-TTE dokumenTteId=${binding.dokumenTteId} userId=${binding.userId} jenisDokumen=${binding.jenisDokumen}`,
  ].join(' | ');
}

export function parsePdfTteSigningReason(reason: string | null): PdfTteSignatureBinding | null {
  if (reason === null || !reason.includes('SI-SOP-TTE')) {
    return null;
  }
  const dokumenTteId = matchReasonToken(reason, 'dokumenTteId');
  const userId = matchReasonToken(reason, 'userId');
  const jenisDokumen = matchReasonToken(reason, 'jenisDokumen');
  if (dokumenTteId === null || userId === null || jenisDokumen === null) {
    return null;
  }
  return { dokumenTteId, userId, jenisDokumen };
}

export function verifyPdfSignatures(
  pdfBuffer: Buffer,
  trusted: TrustedPdfCertificates,
  verifiedAt: Date = new Date(),
): VerifyPdfSignaturesResult {
  assertValidPdfBuffer(pdfBuffer);
  const fields = extractPdfSignatureFields(pdfBuffer);
  const signatures = fields.map((field, index) =>
    verifyEmbeddedSignature(pdfBuffer, field, trusted, verifiedAt, index + 1),
  );
  return {
    hasSignatures: signatures.length > 0,
    allValid: signatures.length > 0 && signatures.every((entry) => entry.valid),
    signatures,
  };
}

export function verifyPdfWithP12(
  pdfBuffer: Buffer,
  p12Buffer: Buffer,
  passphrase: string,
  verifiedAt: Date = new Date(),
): VerifyPdfSignaturesResult {
  const trusted = loadTrustedCertificatesFromP12(p12Buffer, passphrase);
  return verifyPdfSignatures(pdfBuffer, trusted, verifiedAt);
}

export function verifyPdfSignaturesGeneric(
  pdfBuffer: Buffer,
  verifiedAt: Date = new Date(),
): VerifyPdfSignaturesResult {
  assertValidPdfBuffer(pdfBuffer);
  const fields = extractPdfSignatureFields(pdfBuffer);
  const signatures = fields.map((field, index) =>
    verifyEmbeddedSignatureGeneric(pdfBuffer, field, verifiedAt, index + 1),
  );
  return {
    hasSignatures: signatures.length > 0,
    allValid: signatures.length > 0 && signatures.every((entry) => entry.valid),
    signatures,
  };
}

function verifyEmbeddedSignature(
  pdfBuffer: Buffer,
  field: PdfEmbeddedSignatureField,
  trusted: TrustedPdfCertificates,
  verifiedAt: Date,
  index: number,
): PdfSignatureVerificationEntry {
  const documentDigest = computeDocumentDigest(pdfBuffer, field.byteRange);
  let pkcs7: PkcsSignedDataMessage;
  try {
    const parsed = forge.pkcs7.messageFromAsn1(
      forge.asn1.fromDer(field.pkcs7Buffer.toString('binary')),
    );
    if (!('certificates' in parsed) || !Array.isArray(parsed.certificates)) {
      return buildInvalidEntry(
        index,
        'Struktur PKCS#7 tidak memuat sertifikat.',
        trusted,
        verifiedAt,
      );
    }
    pkcs7 = parsed as PkcsSignedDataMessage;
  } catch {
    return buildInvalidEntry(index, 'Struktur PKCS#7 tidak valid.', trusted, verifiedAt);
  }
  const embeddedDigest = extractMessageDigestFromPkcs7(field.pkcs7Buffer);
  const digestMatch = embeddedDigest !== null && embeddedDigest.equals(documentDigest);
  const signingCertificate = findTrustedSigningCertificate(pkcs7, trusted);
  if (!signingCertificate) {
    return buildInvalidEntry(
      index,
      'Sertifikat penandatangan tidak dikenali pada rantai kepercayaan internal.',
      trusted,
      verifiedAt,
      trusted.signingCertificate,
      { digestMatch, chainTrusted: false, certificatePeriodValid: false },
    );
  }
  const chainTrusted = trusted.caCertificate.verify(signingCertificate);
  const certificatePeriodValid = isCertificateValidAt(signingCertificate, verifiedAt);
  const certificate = mapCertificateToResponse(signingCertificate);
  const signatureValue = `sha256:${createHash('sha256').update(field.pkcs7Buffer).digest('hex')}`;
  const valid = digestMatch && chainTrusted && certificatePeriodValid;
  const reason = valid
    ? 'Tanda tangan valid dalam CA internal SOPFlow.'
    : buildFailureReason({ digestMatch, chainTrusted, certificatePeriodValid });
  return {
    index,
    valid,
    reason,
    signatureValue,
    signerSubject: certificate.subject,
    signerIssuer: certificate.issuer,
    signedAt: extractSigningTime(field.pkcs7Buffer),
    binding: parsePdfTteSigningReason(field.reason),
    certificate: {
      validFrom: certificate.validFrom,
      validTo: certificate.validTo,
      fingerprint: certificate.fingerprint,
      serialNumber: certificate.serialNumber,
    },
    checks: {
      digestMatch,
      chainTrusted,
      certificatePeriodValid,
    },
  };
}

function buildInvalidEntryGeneric(index: number, reason: string): PdfSignatureVerificationEntry {
  return {
    index,
    valid: false,
    reason,
    signatureValue: '',
    signerSubject: '',
    signerIssuer: '',
    signedAt: null,
    binding: null,
    certificate: {
      validFrom: '',
      validTo: '',
      fingerprint: '',
      serialNumber: '',
    },
    checks: {
      digestMatch: false,
      chainTrusted: false,
      certificatePeriodValid: false,
    },
  };
}

function verifyEmbeddedSignatureGeneric(
  pdfBuffer: Buffer,
  field: PdfEmbeddedSignatureField,
  verifiedAt: Date,
  index: number,
): PdfSignatureVerificationEntry {
  const documentDigest = computeDocumentDigest(pdfBuffer, field.byteRange);
  let pkcs7: PkcsSignedDataMessage;
  try {
    const parsed = forge.pkcs7.messageFromAsn1(
      forge.asn1.fromDer(field.pkcs7Buffer.toString('binary')),
    );
    if (!('certificates' in parsed) || !Array.isArray(parsed.certificates)) {
      throw new Error('No certificates');
    }
    pkcs7 = parsed as PkcsSignedDataMessage;
  } catch {
    return buildInvalidEntryGeneric(index, 'Struktur PKCS#7 tidak valid.');
  }
  const embeddedDigest = extractMessageDigestFromPkcs7(field.pkcs7Buffer);
  const digestMatch = embeddedDigest !== null && embeddedDigest.equals(documentDigest);

  // Ambil cert penandatangan dari dalam PDF itu sendiri (biasanya bukan CA)
  const signingCertificate =
    pkcs7.certificates.find((c) => !isCertificateAuthority(c)) || pkcs7.certificates[0];
  if (!signingCertificate) {
    return buildInvalidEntryGeneric(index, 'Sertifikat penandatangan tidak ditemukan.');
  }
  const certificatePeriodValid = isCertificateValidAt(signingCertificate, verifiedAt);
  const certificate = mapCertificateToResponse(signingCertificate);
  const signatureValue = `sha256:${createHash('sha256').update(field.pkcs7Buffer).digest('hex')}`;
  const valid = digestMatch && certificatePeriodValid;
  const reason = valid
    ? 'Tanda tangan valid dan tidak diubah sejak ditandatangani.'
    : buildFailureReason({ digestMatch, chainTrusted: true, certificatePeriodValid });
  return {
    index,
    valid,
    reason,
    signatureValue,
    signerSubject: certificate.subject,
    signerIssuer: certificate.issuer,
    signedAt: extractSigningTime(field.pkcs7Buffer),
    binding: parsePdfTteSigningReason(field.reason),
    certificate: {
      validFrom: certificate.validFrom,
      validTo: certificate.validTo,
      fingerprint: certificate.fingerprint,
      serialNumber: certificate.serialNumber,
    },
    checks: {
      digestMatch,
      chainTrusted: true,
      certificatePeriodValid,
    },
  };
}

type PkcsSignedDataMessage = {
  readonly certificates: readonly forge.pki.Certificate[];
};

function findTrustedSigningCertificate(
  pkcs7: PkcsSignedDataMessage,
  trusted: TrustedPdfCertificates,
): forge.pki.Certificate | null {
  for (const cert of pkcs7.certificates) {
    if (isCertificateAuthority(cert)) {
      continue;
    }
    if (trusted.caCertificate.verify(cert)) {
      return cert;
    }
  }
  return null;
}

function buildInvalidEntry(
  index: number,
  reason: string,
  trusted: TrustedPdfCertificates,
  verifiedAt: Date,
  signingCertificate: forge.pki.Certificate = trusted.signingCertificate,
  checks: PdfSignatureVerificationEntry['checks'] = {
    digestMatch: false,
    chainTrusted: false,
    certificatePeriodValid: isCertificateValidAt(signingCertificate, verifiedAt),
  },
): PdfSignatureVerificationEntry {
  const certificate = mapCertificateToResponse(signingCertificate);
  return {
    index,
    valid: false,
    reason,
    signatureValue: '',
    signerSubject: certificate.subject,
    signerIssuer: certificate.issuer,
    signedAt: null,
    binding: null,
    certificate: {
      validFrom: certificate.validFrom,
      validTo: certificate.validTo,
      fingerprint: certificate.fingerprint,
      serialNumber: certificate.serialNumber,
    },
    checks,
  };
}

function matchReasonToken(reason: string, key: string): string | null {
  const match = reason.match(new RegExp(`(?:^|\\s)${key}=([^\\s|]+)`));
  return match?.[1] ?? null;
}

function extractSignatureDictionary(pdfText: string, at: number): string {
  const start = pdfText.lastIndexOf('<<', at);
  const end = pdfText.indexOf('>>', at);
  if (start < 0 || end < 0 || end <= start) {
    return '';
  }
  return pdfText.slice(start, end + 2);
}

function extractPdfLiteralString(dictionary: string, key: string): string | null {
  const start = dictionary.indexOf(`/${key}`);
  if (start < 0) {
    return null;
  }
  const open = dictionary.indexOf('(', start);
  if (open < 0) {
    return null;
  }
  let value = '';
  let escaped = false;
  for (let index = open + 1; index < dictionary.length; index += 1) {
    const char = dictionary[index];
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === ')') {
      return value;
    }
    value += char;
  }
  return null;
}

function buildFailureReason(checks: PdfSignatureVerificationEntry['checks']): string {
  const failures: string[] = [];
  if (!checks.digestMatch) {
    failures.push('integritas dokumen tidak cocok (hash byte range)');
  }
  if (!checks.chainTrusted) {
    failures.push('rantai sertifikat tidak dipercaya oleh CA internal');
  }
  if (!checks.certificatePeriodValid) {
    failures.push('sertifikat di luar masa berlaku');
  }
  return failures.join('; ');
}

function computeDocumentDigest(
  pdfBuffer: Buffer,
  byteRange: readonly [number, number, number, number],
): Buffer {
  const [start1, length1, start2, length2] = byteRange;
  const part1 = pdfBuffer.subarray(start1, start1 + length1);
  const part2 = pdfBuffer.subarray(start2, start2 + length2);
  return createHash('sha256')
    .update(Buffer.concat([part1, part2]))
    .digest();
}

function trimPkcs7Buffer(buffer: Buffer): Buffer {
  let end = buffer.length;
  while (end > 0 && buffer[end - 1] === 0) {
    end -= 1;
  }
  return buffer.subarray(0, end);
}

function isCertificateValidAt(cert: forge.pki.Certificate, at: Date): boolean {
  return at >= cert.validity.notBefore && at <= cert.validity.notAfter;
}

function isCertificateAuthority(cert: forge.pki.Certificate): boolean {
  const basicConstraints = cert.getExtension({ name: 'basicConstraints' }) as {
    cA?: boolean;
  } | null;
  return Boolean(basicConstraints?.cA);
}

function extractSigningTime(pkcs7Buffer: Buffer): string | null {
  try {
    const pkcs7Asn1 = forge.asn1.fromDer(pkcs7Buffer.toString('binary'));
    const signingTime = findSigningTimeAttribute(pkcs7Asn1);
    if (signingTime !== null) {
      return signingTime.toISOString();
    }
  } catch {
    // Pertahankan fallback DER sederhana untuk PDF lama atau PKCS#7 non-standar.
  }
  return extractSigningTimeFromDerHex(pkcs7Buffer);
}

function findSigningTimeAttribute(node: forge.asn1.Asn1): Date | null {
  const children = Array.isArray(node.value) ? node.value : [];
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (isSigningTimeOid(child)) {
      const value = children[index + 1];
      return value ? findAsn1TimeValue(value) : null;
    }
    const nested = findSigningTimeAttribute(child);
    if (nested !== null) {
      return nested;
    }
  }
  return null;
}

function isSigningTimeOid(node: forge.asn1.Asn1): boolean {
  if (node.type !== forge.asn1.Type.OID || typeof node.value !== 'string') {
    return false;
  }
  try {
    return forge.asn1.derToOid(node.value) === '1.2.840.113549.1.9.5';
  } catch {
    return false;
  }
}

function findAsn1TimeValue(node: forge.asn1.Asn1): Date | null {
  if (typeof node.value === 'string') {
    if (node.type === forge.asn1.Type.UTCTIME) {
      return forge.asn1.utcTimeToDate(node.value);
    }
    if (node.type === forge.asn1.Type.GENERALIZEDTIME) {
      return forge.asn1.generalizedTimeToDate(node.value);
    }
  }
  const children = Array.isArray(node.value) ? node.value : [];
  for (const child of children) {
    const nested = findAsn1TimeValue(child);
    if (nested !== null) {
      return nested;
    }
  }
  return null;
}

function extractSigningTimeFromDerHex(pkcs7Buffer: Buffer): string | null {
  const signingTimeOidHex = '06092a864886f70d010905';
  const pkcs7Hex = pkcs7Buffer.toString('hex');
  const oidIndex = pkcs7Hex.indexOf(signingTimeOidHex);
  if (oidIndex < 0) {
    return null;
  }
  const afterOid = pkcs7Hex.slice(oidIndex + signingTimeOidHex.length);
  const utcTagIndex = afterOid.indexOf('170d');
  if (utcTagIndex < 0) {
    return null;
  }
  const utcHex = afterOid.slice(utcTagIndex + 4, utcTagIndex + 4 + 26);
  if (utcHex.length !== 26) {
    return null;
  }
  const utcText = Buffer.from(utcHex, 'hex').toString('ascii');
  const match = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(utcText);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]) >= 50 ? `19${match[1]}` : `20${match[1]}`;
  const parsed = new Date(`${year}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}
