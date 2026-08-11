import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { useAuthStore } from "@/stores/authStore";
import { STALE_TIME } from "@/utils/constants";
import { sopApi } from "@/api/sop-client";
import { invalidateSopEvaluasiWorkflow } from "@/lib/api/cache-invalidation";
import type {
  CreatePelaksanaMutationDto,
  Pelaksana,
  PenyusunWorkbenchData,
  SetSopStatusOverrideMutationDto,
  UpdatePelaksanaMutationDto,
  UpdateSopHeaderDto,
  UpdateSopProsedurDto,
  UpdateSopDiagramDto,
} from "@/types/dto/sop.dto";
/**
 * useSopStatus hook - TanStack Query
 * Replaces localStorage-based status simulation with real API calls
 */

async function syncSopWorkbenchAfterStatusChange(
  queryClient: ReturnType<typeof useQueryClient>,
  data: PenyusunWorkbenchData,
  requestedId: string,
) {
  queryClient.setQueryData(queryKeys.penyusunWorkbench(requestedId), data);
  queryClient.setQueryData(queryKeys.penyusunWorkbench(data.detail.id), data);

  await Promise.all([
    invalidateSopEvaluasiWorkflow(queryClient),
    queryClient.invalidateQueries({ queryKey: queryKeys.sopRiwayatVersi(data.detail.sopId) }),
  ]);
}

/**
 * Hook to update SOP status via real API
 * Replaces previous localStorage-based simulation
 */
export function useSopStatus() {
  const queryClient = useQueryClient();
  const updateStatusMutation = useMutationWithToast({
    mutationFn: ({ sopId, status }: SetSopStatusOverrideMutationDto) =>
      sopApi.updateStatus(sopId, { status }),
    onSuccess: (data, variables) =>
      syncSopWorkbenchAfterStatusChange(queryClient, data, variables.sopId),
    successMessage: "Status SOP berhasil diubah",
    useDetailedErrors: true,
    errorMessagePrefix: "Gagal mengubah status SOP",
  });

  return {
    /**
     * Update SOP status via API
     * @param sopId - SOP Detail ID
     * @param status - New status (StatusSOP)
     */
    setSopStatusOverride: (sopId: string, status: SetSopStatusOverrideMutationDto["status"]) => {
      updateStatusMutation.mutate({ sopId, status });
    },

    /**
     * Update SOP status via API (async)
     * @param sopId - SOP Detail ID
     * @param status - New status (StatusSOP)
     */
    setSopStatusOverrideAsync: updateStatusMutation.mutateAsync,

    /**
     * Check if status update is in progress
     */
    isUpdating: updateStatusMutation.isPending,

    /**
     * Error from last status update attempt
     */
    error: updateStatusMutation.error,
  };
}

/**
 * Hook untuk mencabut SOP BERLAKU (Kepala OPD).
 */
export function useCabutSop() {
  const queryClient = useQueryClient();
  const mutation = useMutationWithToast({
    mutationFn: (sopOrDetailId: string) => sopApi.cabutSop(sopOrDetailId),
    onSuccess: (data, sopOrDetailId) =>
      syncSopWorkbenchAfterStatusChange(queryClient, data, sopOrDetailId),
    successMessage: 'SOP berhasil dicabut',
    useDetailedErrors: true,
    errorMessagePrefix: 'Gagal mencabut SOP',
  });
  return {
    cabutSop: mutation.mutate,
    cabutSopAsync: mutation.mutateAsync,
    isCabutPending: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * usePelaksana Hook - TanStack Query Implementation
 */

export function usePelaksana(opdId?: string) {
  const user = useAuthStore((s) => s.user);
  const effectiveOpdId = opdId || user?.opdId;

  const {
    data: list = [],
    isLoading,
    error,
  } = useQuery<Pelaksana[]>({
    queryKey: queryKeys.pelaksanaByOpd(effectiveOpdId || ""),
    queryFn: () => sopApi.findPelaksana(effectiveOpdId || ""),
    enabled: !!effectiveOpdId,
    staleTime: STALE_TIME.MEDIUM,
  });

  const createMutation = useMutationWithToast({
    mutationFn: (data: CreatePelaksanaMutationDto) => {
      const targetOpdId = data.opdId || effectiveOpdId;
      if (!targetOpdId) throw new Error("opdId is required - Pelaksana harus memiliki OPD");
      return sopApi.createPelaksana({
        opdId: targetOpdId,
        namaPelaksana: data.namaPelaksana,
      });
    },
    invalidateKeys: [queryKeys.pelaksana, queryKeys.sop, queryKeys.evaluasi],
    successMessage: "Pelaksana SOP berhasil ditambahkan",
    errorMessagePrefix: "Gagal menambah pelaksana",
  });

  const updateMutation = useMutationWithToast({
    mutationFn: ({ id, namaPelaksana }: UpdatePelaksanaMutationDto) =>
      sopApi.updatePelaksana(id, namaPelaksana),
    invalidateKeys: [queryKeys.pelaksana, queryKeys.sop, queryKeys.evaluasi],
    successMessage: "Pelaksana SOP berhasil diperbarui",
    errorMessagePrefix: "Gagal memperbarui pelaksana",
  });

  const deleteMutation = useMutationWithToast({
    mutationFn: (id: string) => sopApi.deletePelaksana(id),
    invalidateKeys: [queryKeys.pelaksana, queryKeys.sop, queryKeys.evaluasi],
    successMessage: "Pelaksana SOP berhasil dihapus",
    errorMessagePrefix: "Gagal menghapus pelaksana",
  });

  return {
    list,
    isLoading,
    error,
    addPelaksana: createMutation.mutateAsync,
    updatePelaksana: updateMutation.mutateAsync,
    removePelaksana: deleteMutation.mutateAsync,
  };
}

export function useBuatVersiBaru() {
  const queryClient = useQueryClient();
  return useMutationWithToast({
    mutationFn: (detailSopId: string) => sopApi.buatVersiBaru(detailSopId),
    invalidateKeys: [queryKeys.sop],
    successMessage: 'Versi baru berhasil dibuat',
    useDetailedErrors: true,
    errorMessagePrefix: 'Gagal membuat versi baru',
    onSuccess: (data, detailSopId) => {
      queryClient.setQueryData(queryKeys.penyusunWorkbench(data.detail.id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.sopRiwayatVersi(data.detail.sopId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.penyusunWorkbench(detailSopId) });
    },
  });
}

export function useHapusVersiDraft(sopId: string) {
  return useMutationWithToast({
    mutationFn: (detailSopId: string) => sopApi.hapusVersiDraft(detailSopId),
    invalidateKeys: [queryKeys.sop, queryKeys.sopRiwayatVersi(sopId)],
    successMessage: 'Versi draft dihapus',
    useDetailedErrors: true,
    errorMessagePrefix: 'Gagal menghapus versi draft',
  });
}

export function useHapusSopDraftAwal() {
  return useMutationWithToast({
    mutationFn: (detailSopId: string) => sopApi.hapusSopDraftAwal(detailSopId),
    invalidateKeys: [queryKeys.sop],
    successMessage: 'Draft SOP berhasil dihapus',
    useDetailedErrors: true,
    errorMessagePrefix: 'Gagal menghapus draft SOP',
  });
}

/**
 * Mutation autosave PATCH header SOP. Tidak memunculkan toast (silent autosave),
 * tidak meng-invalidate cache; sebagai gantinya `setQueryData` workbench dengan response
 * agar panel main + side panel tetap sinkron tanpa GET ulang.
 */
export function useUpdateSopHeader(detailSopId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSopHeaderDto) => sopApi.updateSopHeader(detailSopId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.penyusunWorkbench(detailSopId), data);
      if (data.detail.id !== detailSopId) {
        queryClient.setQueryData(queryKeys.penyusunWorkbench(data.detail.id), data);
      }
      void invalidateSopEvaluasiWorkflow(queryClient, 'none');
    },
  });
}

/**
 * Mutation autosave PATCH prosedur SOP (swimlane + langkah) — silent, sejajar dengan
 * `useUpdateSopHeader`. Response = workbench terbaru → `setQueryData` agar main panel
 * & side panel sinkron tanpa GET ulang.
 */
export function useUpdateSopProsedur(detailSopId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSopProsedurDto) => sopApi.updateSopProsedur(detailSopId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.penyusunWorkbench(detailSopId), data);
      if (data.detail.id !== detailSopId) {
        queryClient.setQueryData(queryKeys.penyusunWorkbench(data.detail.id), data);
      }
      void invalidateSopEvaluasiWorkflow(queryClient, 'none');
    },
  });
}

export function useUpdateSopDiagram(detailSopId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSopDiagramDto) => sopApi.updateSopDiagram(detailSopId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.penyusunWorkbench(detailSopId), data);
      if (data.detail.id !== detailSopId) {
        queryClient.setQueryData(queryKeys.penyusunWorkbench(data.detail.id), data);
      }
      void invalidateSopEvaluasiWorkflow(queryClient, 'none');
    },
  });
}
