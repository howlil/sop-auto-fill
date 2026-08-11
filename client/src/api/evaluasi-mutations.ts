import { queryKeys } from "@/config/query-keys";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { evaluasiApi } from "@/api/evaluasi-client";
import { SOP_EVALUASI_WORKFLOW_QUERY_KEYS } from "@/lib/api/cache-invalidation";

export function useTandaiTindakLanjutSelesai(detailSopId: string | undefined) {
  return useMutationWithToast({
    mutationFn: ({
      pengajuanEvaluasiId,
      detailSopId: detailId,
    }: {
      pengajuanEvaluasiId: string
      detailSopId: string
    }) => evaluasiApi.tandaiTindakLanjutSelesai(pengajuanEvaluasiId, detailId),
    invalidateKeys: [
      ...SOP_EVALUASI_WORKFLOW_QUERY_KEYS,
      queryKeys.evaluasiUmpanBalik(detailSopId ?? ''),
      queryKeys.penyusunWorkbench(detailSopId ?? ''),
    ],
    successMessage: 'Umpan balik evaluasi ditandai selesai',
    errorMessagePrefix: 'Gagal menandai tindak lanjut',
  })
}

export function useTolakPengajuanEvaluasi() {
  return useMutationWithToast({
    mutationFn: ({
      pengajuanEvaluasiId,
      alasan,
      version,
    }: {
      pengajuanEvaluasiId: string
      alasan: string
      version: number
    }) => evaluasiApi.tolak(pengajuanEvaluasiId, { alasan, version }),
    invalidateKeys: SOP_EVALUASI_WORKFLOW_QUERY_KEYS,
    successMessage: 'Pengajuan evaluasi berhasil ditolak',
    errorMessagePrefix: 'Gagal menolak pengajuan evaluasi',
  })
}
