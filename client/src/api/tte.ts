/**
 * TTE (Tanda Tangan Elektronik) API — mirror Nest `/tte` (bungkus `{ message, success, data }`).
 */

import { apiClient } from "@/lib/api/api-client";
import { unwrapApiData } from "@/lib/api/response";
import type { ApiSuccessResponse } from "@/types/dto/auth.dto";
import type {
  RegisterTteDto,
  UpdateTtePinDto,
  RiwayatTandaTangan,
  SignPdfDto,
  SignPdfResponse,
  PdfSigningStatus,

  VerifyPdfResponse,
  TtePengesahanPublic,
  TteProfil,
  TandaTanganiBaDto,
  TandaTanganiBaMutationDto,
  TandaTanganiSopPengajuanDto,
  TandaTanganiSopPengajuanMutationDto,
  TandaTanganiSopPengajuanResponse,
  GenerateP12Dto,
  UploadP12Dto,
  SetupTteGenerateDto,
  SetupTteUploadDto,
} from "@/types/dto/tte.dto";

export const tteApi = {
  getProfil: () =>
    unwrapApiData<TteProfil | null>(
      apiClient.get<ApiSuccessResponse<TteProfil | null>>("/tte/profil"),
    ),

  registerProfil: (payload: RegisterTteDto) =>
    unwrapApiData<TteProfil>(
      apiClient.post<ApiSuccessResponse<TteProfil>>("/tte/profil", payload),
    ),

  updateProfilPin: (payload: UpdateTtePinDto) =>
    unwrapApiData<TteProfil>(
      apiClient.patch<ApiSuccessResponse<TteProfil>>("/tte/profil/pin", payload),
    ),

  signPdf: (payload: SignPdfDto) =>
    unwrapApiData<SignPdfResponse>(
      apiClient.post<ApiSuccessResponse<SignPdfResponse>>("/tte/pdf/sign", payload),
    ),

  generateP12: (payload: GenerateP12Dto) =>
    unwrapApiData<TteProfil>(
      apiClient.post<ApiSuccessResponse<TteProfil>>("/tte/profil/generate-p12", payload),
    ),

  uploadP12: (payload: UploadP12Dto, file: File) => {
    const formData = new FormData();
    formData.append("pin", payload.pin);
    formData.append("p12Passphrase", payload.p12Passphrase);
    formData.append("file", file);
    return unwrapApiData<TteProfil>(
      apiClient.post<ApiSuccessResponse<TteProfil>>("/tte/profil/upload-p12", formData),
    );
  },

  setupTteGenerate: (payload: SetupTteGenerateDto) =>
    unwrapApiData<TteProfil>(
      apiClient.post<ApiSuccessResponse<TteProfil>>("/tte/profil/setup/generate", payload),
    ),

  setupTteWithUpload: (payload: SetupTteUploadDto, file: File) => {
    const formData = new FormData();
    formData.append("pin", payload.pin);
    formData.append("p12Passphrase", payload.p12Passphrase);
    formData.append("file", file);
    return unwrapApiData<TteProfil>(
      apiClient.post<ApiSuccessResponse<TteProfil>>("/tte/profil/setup/upload", formData),
    );
  },

  /** Verifikasi pengesahan (publik, tanpa login). */
  getPengesahanPublic: (dokumenTteId: string, userId: string) =>
    unwrapApiData<TtePengesahanPublic>(
      apiClient.get<ApiSuccessResponse<TtePengesahanPublic>>(
        `/tte/public/pengesahan/${encodeURIComponent(dokumenTteId)}/${encodeURIComponent(userId)}`,
      ),
    ),

  getPdfSigningStatus: () =>
    unwrapApiData<PdfSigningStatus>(
      apiClient.get<ApiSuccessResponse<PdfSigningStatus>>('/tte/public/pdf-signing/status'),
    ),

  verifyPdf: (pdfBase64: string) =>
    unwrapApiData<VerifyPdfResponse>(
      apiClient.post<ApiSuccessResponse<VerifyPdfResponse>>('/tte/public/pdf/verify', {
        pdfBase64,
      }),
    ),

  tandaTanganiBA: (pengajuanId: string, payload: TandaTanganiBaDto) =>
    unwrapApiData<RiwayatTandaTangan>(
      apiClient.post<ApiSuccessResponse<RiwayatTandaTangan>>(
        `/tte/tanda-tangani/ba/${pengajuanId}`,
        payload,
      ),
    ),

  tandaTanganiSemuaSopPengajuan: (
    pengajuanId: string,
    payload: TandaTanganiSopPengajuanDto,
  ) =>
    unwrapApiData<TandaTanganiSopPengajuanResponse>(
      apiClient.post<ApiSuccessResponse<TandaTanganiSopPengajuanResponse>>(
        `/tte/tanda-tangani/pengajuan/${pengajuanId}/sop-semua`,
        payload,
      ),
    ),
};

/**
 * useTTE hook - TanStack Query
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { isTteSetupRequiredError } from "@/lib/tte/tte-setup-state";
import { STALE_TIME } from "@/utils/constants";
import { SOP_EVALUASI_WORKFLOW_QUERY_KEYS } from "@/lib/api/cache-invalidation";

export function useTTEProfil(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tteProfil,
    queryFn: () => tteApi.getProfil(),
    staleTime: STALE_TIME.MEDIUM,
    retry: false,
    enabled: options?.enabled ?? true,
  });
}

export function useTtePengesahanPublic(dokumenTteId: string, userId: string) {
  return useQuery({
    queryKey: queryKeys.ttePengesahanPublic(dokumenTteId, userId),
    queryFn: () => tteApi.getPengesahanPublic(dokumenTteId, userId),
    staleTime: STALE_TIME.LONG,
    retry: false,
  });
}

export function usePdfSigningStatus() {
  return useQuery({
    queryKey: queryKeys.ttePdfSigningStatus,
    queryFn: () => tteApi.getPdfSigningStatus(),
    staleTime: STALE_TIME.MEDIUM,
    retry: false,
  });
}

export function useRegisterTTE() {
  return useMutationWithToast({
    mutationFn: (payload: RegisterTteDto) => tteApi.registerProfil(payload),
    invalidateKeys: [queryKeys.tteProfil, queryKeys.auth],
    successMessage: "PIN TTE berhasil diatur",
    useDetailedErrors: true,
    errorMessagePrefix: "Gagal mengatur PIN TTE",
  });
}

export function useUpdateTTEPin() {
  return useMutationWithToast({
    mutationFn: (payload: UpdateTtePinDto) => tteApi.updateProfilPin(payload),
    invalidateKeys: [queryKeys.tteProfil, queryKeys.auth],
    successMessage: "PIN TTE berhasil diperbarui",
    useDetailedErrors: true,
    errorMessagePrefix: "Gagal memperbarui PIN TTE",
  });
}

export function useGenerateP12() {
  return useMutationWithToast({
    mutationFn: (payload: GenerateP12Dto) => tteApi.generateP12(payload),
    invalidateKeys: [queryKeys.tteProfil],
    successMessage: "Sertifikat P12 personal berhasil dibuat",
    useDetailedErrors: true,
    errorMessagePrefix: "Gagal membuat sertifikat P12",
  });
}

export function useUploadP12() {
  return useMutationWithToast({
    mutationFn: ({ payload, file }: { payload: UploadP12Dto; file: File }) =>
      tteApi.uploadP12(payload, file),
    invalidateKeys: [queryKeys.tteProfil],
    successMessage: "Sertifikat P12 berhasil diunggah",
    useDetailedErrors: true,
    errorMessagePrefix: "Gagal mengunggah sertifikat P12",
  });
}

export function useSetupTteGenerate() {
  return useMutationWithToast({
    mutationFn: (payload: SetupTteGenerateDto) => tteApi.setupTteGenerate(payload),
    invalidateKeys: [queryKeys.tteProfil, queryKeys.auth],
    successMessage: "TTE berhasil disiapkan",
    useDetailedErrors: true,
    errorMessagePrefix: "Gagal menyiapkan TTE",
  });
}

export function useSetupTteUpload() {
  return useMutationWithToast({
    mutationFn: ({ payload, file }: { payload: SetupTteUploadDto; file: File }) =>
      tteApi.setupTteWithUpload(payload, file),
    invalidateKeys: [queryKeys.tteProfil, queryKeys.auth],
    successMessage: "TTE berhasil disiapkan dengan sertifikat BSrE",
    useDetailedErrors: true,
    errorMessagePrefix: "Gagal menyiapkan TTE dengan sertifikat BSrE",
  });
}

export function useTandaTanganiBA(options?: {
  isPjPenyusun?: boolean;
  /** Mengganti pesan sukses bawaan (satu sumber toast; jangan panggil showToast lagi setelah mutateAsync). */
  successMessage?: string;
  suppressSetupRequiredToast?: boolean;
}) {
  const defaultSuccessPjPenyusun =
    "Berita Acara berhasil ditandatangani oleh PJ Penyusun.";
  const defaultSuccessEvaluator = "Berita Acara berhasil ditandatangani";
  const successMessage =
    options?.successMessage ??
    (options?.isPjPenyusun ? defaultSuccessPjPenyusun : defaultSuccessEvaluator);
  return useMutationWithToast({
    mutationFn: ({ pengajuanId, payload }: TandaTanganiBaMutationDto) =>
      tteApi.tandaTanganiBA(pengajuanId, payload),
    invalidateKeys: [...SOP_EVALUASI_WORKFLOW_QUERY_KEYS, queryKeys.tte],
    successMessage,
    useDetailedErrors: true,
    errorMessagePrefix: "Gagal menandatangani Berita Acara",
    shouldSuppressErrorToast: options?.suppressSetupRequiredToast
      ? (error) => isTteSetupRequiredError(error)
      : undefined,
  });
}

export function useTandaTanganiSopPengajuan(options?: {
  suppressSetupRequiredToast?: boolean;
}) {
  return useMutationWithToast({
    mutationFn: ({ pengajuanId, payload }: TandaTanganiSopPengajuanMutationDto) =>
      tteApi.tandaTanganiSemuaSopPengajuan(pengajuanId, payload),
    invalidateKeys: [...SOP_EVALUASI_WORKFLOW_QUERY_KEYS, queryKeys.tte],
    successMessage: "Seluruh SOP dalam pengajuan berhasil ditandatangani.",
    useDetailedErrors: true,
    errorMessagePrefix: "Gagal menandatangani seluruh SOP pengajuan",
    shouldSuppressErrorToast: options?.suppressSetupRequiredToast
      ? (error) => isTteSetupRequiredError(error)
      : undefined,
  });
}

// ==================== Pin Confirmation Handler Utility ====================
/**
 * Membuat handler konfirmasi PIN untuk penandatanganan TTE.
 */
export function createPinConfirmHandler<T>(
  mutateAsync: (vars: T) => Promise<unknown>,
  buildPayload: (pin: string) => T,
  onSuccess?: () => void,
  onError?: (error: unknown) => void,
) {
  return async (pin: string): Promise<boolean> => {
    try {
      await mutateAsync(buildPayload(pin));
      onSuccess?.();
      return true;
    } catch (error) {
      onError?.(error);
      return false;
    }
  };
}
