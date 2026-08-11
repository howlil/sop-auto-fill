export type {
  PdfSigningStatusResponse,
  SignPdfResponse,
  VerifyPdfResponse,
} from '../../penandatanganan/tte-pdf-signing.service';

/** Respons profil TTE untuk klien — PIN disimpan di baris `Pengguna`. */
export type TteProfilResponse = {
  readonly id: string;
  readonly userId: string;
  readonly peran: 'KEPALA_OPD' | 'PJ_EVALUATOR' | 'PJ_PENYUSUN';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly hasP12: boolean;
  readonly user?: {
    readonly id: string;
    readonly nama: string;
    readonly email: string;
    readonly nip: string;
    readonly jabatan: string;
    readonly pangkat: string;
  };
};

export type TteRiwayatResponse = {
  readonly id: string;
  readonly userId: string;
  readonly peran: 'KEPALA_OPD' | 'PJ_EVALUATOR' | 'PJ_PENYUSUN';
  readonly dokumenTteId: string;
  readonly nomorDokumen: string;
  readonly jenisDokumen: string;
  readonly judulDokumen: string;
  readonly hashDokumen: string;
  readonly sopDetailId?: string;
  readonly pengajuanEvaluasiId?: string;
  readonly ditandatanganiPada: string;
  readonly user?: { readonly id: string; readonly nama: string; readonly nip: string };
  readonly qrVerificationUrl: string | null;
  readonly qrPayload: string;
};

export type TtePengesahanPublicResponse = {
  readonly userId: string;
  readonly dokumenTteId: string;
  readonly ditandatanganiPada: string;
  readonly peran: 'KEPALA_OPD' | 'PJ_EVALUATOR' | 'PJ_PENYUSUN';
  readonly penandatangan: {
    readonly nama: string;
    readonly nip: string;
    readonly jabatan: string;
  };
  readonly dokumen: {
    readonly dokumenTteId: string;
    readonly nomorDokumen: string;
    readonly judulDokumen: string;
    readonly jenisDokumen: string;
    readonly hashDokumen: string;
    readonly sopDetailId?: string;
    readonly pengajuanEvaluasiId?: string;
  };
  readonly qrVerificationUrl: string | null;
  readonly qrPayload: string;
};

export type TteBatchSignSopPengajuanResponse = {
  readonly pengajuanEvaluasiId: string;
  readonly totalSopDitandatangani: number;
  readonly ditandatanganiPada: string;
};
