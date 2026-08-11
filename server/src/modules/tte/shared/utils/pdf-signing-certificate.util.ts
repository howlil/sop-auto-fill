import { createHash } from 'crypto';
import forge from 'node-forge';

export type PdfCertificateResponse = {
  readonly subject: string;
  readonly issuer: string;
  readonly serialNumber: string;
  readonly fingerprint: string;
  readonly validFrom: string;
  readonly validTo: string;
};

const MESSAGE_DIGEST_OID_HEX = '06092a864886f70d010904';

export type TrustedPdfCertificates = {
  readonly caCertificate: forge.pki.Certificate;
  readonly signingCertificate: forge.pki.Certificate;
  readonly caSubject: string;
  readonly signingSubject: string;
};

export function loadTrustedCertificatesFromP12(
  p12Buffer: Buffer,
  passphrase: string,
): TrustedPdfCertificates {
  if (p12Buffer.byteLength < 64) {
    throw new Error(
      'PDF_SIGNING_P12_BASE64 tidak valid. Jalankan: npm run pdf-signing:generate-cert di folder server.',
    );
  }
  let p12: ReturnType<typeof forge.pkcs12.pkcs12FromAsn1>;
  try {
    const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'format tidak dikenali';
    if (detail.includes('ASN.1') || detail.includes('Too few bytes')) {
      throw new Error(
        'PDF_SIGNING_P12_BASE64 bukan berkas P12/PFX yang sah. Ganti dengan output npm run pdf-signing:generate-cert.',
      );
    }
    if (detail.toLowerCase().includes('password') || detail.includes('MAC')) {
      throw new Error('PDF_SIGNING_P12_PASSPHRASE salah untuk berkas P12 yang dikonfigurasi.');
    }
    throw new Error(`Gagal membaca sertifikat P12: ${detail}`);
  }
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
  if (!certBags || certBags.length === 0) {
    throw new Error('Certificate bag tidak ditemukan pada berkas P12.');
  }
  const certificates = certBags
    .map((bag) => bag.cert)
    .filter((cert): cert is forge.pki.Certificate => cert !== undefined);
  const caCertificate = certificates.find((cert) => isCertificateAuthority(cert));
  const signingCertificate = certificates.find((cert) => !isCertificateAuthority(cert));
  if (!caCertificate || !signingCertificate) {
    throw new Error('Rantai sertifikat P12 tidak lengkap (CA dan sertifikat penandatangan).');
  }
  return {
    caCertificate,
    signingCertificate,
    caSubject: formatDistinguishedName(caCertificate.subject.attributes),
    signingSubject: formatDistinguishedName(signingCertificate.subject.attributes),
  };
}

export function mapCertificateToResponse(cert: forge.pki.Certificate): PdfCertificateResponse {
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  return {
    subject: formatDistinguishedName(cert.subject.attributes),
    issuer: formatDistinguishedName(cert.issuer.attributes),
    serialNumber: cert.serialNumber,
    fingerprint: createHash('sha256').update(Buffer.from(certDer, 'binary')).digest('hex'),
    validFrom: cert.validity.notBefore.toISOString(),
    validTo: cert.validity.notAfter.toISOString(),
  };
}

export function extractMessageDigestFromPkcs7(pkcs7Buffer: Buffer): Buffer | null {
  const pkcs7Hex = pkcs7Buffer.toString('hex');
  const oidIndex = pkcs7Hex.indexOf(MESSAGE_DIGEST_OID_HEX);
  if (oidIndex < 0) {
    return null;
  }
  const afterOid = pkcs7Hex.slice(oidIndex + MESSAGE_DIGEST_OID_HEX.length);
  const octetTagIndex = afterOid.indexOf('0420');
  if (octetTagIndex < 0) {
    return null;
  }
  const digestHex = afterOid.slice(octetTagIndex + 4, octetTagIndex + 4 + 64);
  if (digestHex.length !== 64) {
    return null;
  }
  return Buffer.from(digestHex, 'hex');
}

function isCertificateAuthority(cert: forge.pki.Certificate): boolean {
  const basicConstraints = cert.getExtension({ name: 'basicConstraints' }) as {
    cA?: boolean;
  } | null;
  return Boolean(basicConstraints?.cA);
}

function formatDistinguishedName(attributes: forge.pki.CertificateField[]): string {
  return attributes
    .map((attribute) => {
      const key = attribute.shortName ?? attribute.name ?? attribute.type;
      return `${key}=${attribute.value}`;
    })
    .join(', ');
}
