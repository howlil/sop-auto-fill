export type PeranTTE = "KEPALA_OPD" | "PJ_EVALUATOR" | "PJ_PENYUSUN";

/** Profil TTE dari GET/POST `/tte/profil` — PIN disimpan di server pada data pengguna. */
export interface TteProfil {
  id: string;
  userId: string;
  peran: PeranTTE;
  hasP12?: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    nama: string;
    email: string;
    nip: string;
    jabatan: string;
    pangkat: string;
  };
}

export interface RiwayatTandaTangan {
  id: string;
  userId: string;
  dokumenTteId: string;
  peran: PeranTTE;
  nomorDokumen: string;
  jenisDokumen: string;
  judulDokumen: string;
  hashDokumen: string;
  sopDetailId?: string;
  pengajuanEvaluasiId?: string;
  ditandatanganiPada: string;
  user?: { id: string; nama: string; nip: string };
  sopDetail?: {
    id: string;
    nomorSOP: string;
    judul: string;
  };
  pengajuanEvaluasi?: {
    id: string;
    nomorBA?: string;
  };
}

export interface TTESignaturePayload {
  /** Turunan `dokumenTteId:userId` — kompatibel dengan ringkasan baris riwayat. */
  id: string;
  dokumenTteId: string;
  userId: string;
  nip: string;
  namaLengkap: string;
  jabatan?: string;
  signedAt?: string;
}

export type JenisDokumenTte = "BERITA_ACARA_EVALUASI" | "SOP_BERLAKU";

export interface SignPdfDto {
  pin: string;
  dokumenTteId: string;
  userId: string;
  jenisDokumen: JenisDokumenTte;
  pdfBase64: string;
}

export interface GenerateP12Dto {
  pin: string;
}

export interface UploadP12Dto {
  pin: string;
  p12Passphrase: string;
}

/** Setup awal TTE: buat sertifikat otomatis + PIN dalam satu request */
export interface SetupTteGenerateDto {
  pin: string;
}

/** Setup awal TTE: unggah P12 BSrE + PIN dalam satu request */
export interface SetupTteUploadDto {
  pin: string;
  p12Passphrase: string;
}

export interface PdfCertificateInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  fingerprint: string;
  validFrom: string;
  validTo: string;
}

export interface SignPdfResponse {
  signed: boolean;
  signedPdfBase64: string;
  sha256SignedPdf: string;
  signatureFormat: "PKCS7_DETACHED" | "UNSIGNED_DISABLED" | "UNSIGNED_NOT_REQUIRED";
  certificate: PdfCertificateInfo | null;
}

export interface PdfSigningStatus {
  enabled: boolean;
  trustedCaSubject: string | null;
  trustedSignerSubject: string | null;
  verificationPath: string;
  configError?: string;
}

export interface PdfSignatureChecks {
  digestMatch: boolean;
  chainTrusted: boolean;
  certificatePeriodValid: boolean;
}

export interface PdfSignatureVerificationEntry {
  index: number;
  valid: boolean;
  reason: string;
  signatureValue: string;
  signerSubject: string;
  signerIssuer: string;
  signedAt: string | null;
  binding: {
    dokumenTteId: string;
    userId: string;
    jenisDokumen: string;
  } | null;
  certificate: {
    validFrom: string;
    validTo: string;
    fingerprint: string;
    serialNumber: string;
  };
  checks: PdfSignatureChecks;
  tteMatch: {
    matched: boolean;
    reason: string;
    dokumenTteId?: string;
    userId?: string;
    peran?: string;
    jenisDokumen?: string;
    nomorDokumen?: string;
    judulDokumen?: string;
    ditandatanganiPada?: string;
  };
}

export interface VerifyPdfResponse {
  pdfSigningEnabled: boolean;
  trustedCaSubject: string | null;
  hasSignatures: boolean;
  allValid: boolean;
  signatures: PdfSignatureVerificationEntry[];
  disclaimer: string;
}

/** Respons GET publik verifikasi pengesahan (`/tte/public/pengesahan/:dokumenTteId/:userId`). */
export interface TtePengesahanPublic {
  userId: string;
  dokumenTteId: string;
  ditandatanganiPada: string;
  peran: PeranTTE;
  penandatangan: {
    nama: string;
    nip: string;
    jabatan: string;
  };
  dokumen: {
    dokumenTteId: string;
    nomorDokumen: string;
    judulDokumen: string;
    jenisDokumen: string;
    hashDokumen: string;
    sopDetailId?: string;
    pengajuanEvaluasiId?: string;
  };
  qrVerificationUrl: string | null;
  qrPayload: string;
}

export type TTERole = "kepala-opd" | "pj-evaluator" | "pj-penyusun";

export interface RegisterTteDto {
  pin: string;
}

export interface UpdateTtePinDto {
  pinLama: string;
  pinBaru: string;
}

export interface TandaTanganiBaDto {
  pin: string;
  nomorDokumen: string;
  judulDokumen: string;
}

export interface TandaTanganiBaMutationDto {
  pengajuanId: string;
  payload: TandaTanganiBaDto;
}

export interface TandaTanganiSopPengajuanDto {
  pin: string;
  nomorDokumen: string;
  judulDokumen: string;
  sopPdfs: Array<{
    detailSopId: string;
    pdfBase64: string;
  }>;
}

export interface TandaTanganiSopPengajuanMutationDto {
  pengajuanId: string;
  payload: TandaTanganiSopPengajuanDto;
}

export interface TandaTanganiSopPengajuanResponse {
  pengajuanEvaluasiId: string;
  totalSopDitandatangani: number;
  ditandatanganiPada: string;
}
