import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/config/query-keys'
import { useToast, showErrorMessages } from '@/hooks/useToast'
import { sopApi } from '@/api/sop-client'
import { apiClient, buildQueryString } from '@/lib/api/api-client'
import type { ApiSuccessResponse } from '@/types/dto/auth.dto'
import type {
  PenyusunWorkbenchResponse,
  StatusSOP,
  UpdateSopDiagramDto,
  UpdateSopHeaderDto,
  UpdateSopProsedurDto,
} from '@/types/dto/sop.dto'

export interface PelaksanaOption {
  id: string
  workspaceId: string
  namaPelaksana: string
}

function useRefreshSop(detailSopId: string) {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.sop }),
      queryClient.invalidateQueries({ queryKey: queryKeys.penyusunWorkbench(detailSopId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sopRiwayatVersi(detailSopId) }),
    ])
  }
}

export function useSopStatus(detailSopId: string) {
  const { showToast } = useToast()
  const refresh = useRefreshSop(detailSopId)
  return useMutation({
    mutationFn: (status: StatusSOP) => sopApi.updateStatus(detailSopId, { status }),
    onSuccess: async () => {
      await refresh()
      showToast('Status SOP berhasil diperbarui', 'success')
    },
    onError: (error: Error) => showErrorMessages(error, 'Gagal memperbarui status SOP'),
  })
}

export function useBuatVersiBaru(detailSopId: string) {
  const { showToast } = useToast()
  const refresh = useRefreshSop(detailSopId)
  return useMutation({
    mutationFn: () => sopApi.buatVersiBaru(detailSopId),
    onSuccess: async () => {
      await refresh()
      showToast('Versi SOP baru berhasil dibuat', 'success')
    },
    onError: (error: Error) => showErrorMessages(error, 'Gagal membuat versi SOP baru'),
  })
}

export function useHapusVersiDraft(detailSopId: string) {
  const refresh = useRefreshSop(detailSopId)
  return useMutation({
    mutationFn: () => sopApi.hapusVersiDraft(detailSopId),
    onSuccess: refresh,
  })
}

export function useHapusSopDraftAwal(detailSopId: string) {
  const refresh = useRefreshSop(detailSopId)
  return useMutation({
    mutationFn: () => sopApi.hapusSopDraftAwal(detailSopId),
    onSuccess: refresh,
  })
}

export function useUpdateSopHeader(detailSopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateSopHeaderDto) => sopApi.updateHeader(detailSopId, payload),
    onSuccess: (data: PenyusunWorkbenchResponse) => {
      queryClient.setQueryData(queryKeys.penyusunWorkbench(detailSopId), data)
      void queryClient.invalidateQueries({ queryKey: queryKeys.sop })
    },
  })
}

export function useUpdateSopProsedur(detailSopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateSopProsedurDto) => sopApi.updateProsedur(detailSopId, payload),
    onSuccess: (data: PenyusunWorkbenchResponse) => {
      queryClient.setQueryData(queryKeys.penyusunWorkbench(detailSopId), data)
    },
  })
}

export function useUpdateSopDiagram(detailSopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateSopDiagramDto) => sopApi.updateDiagram(detailSopId, payload),
    onSuccess: (data: PenyusunWorkbenchResponse) => {
      queryClient.setQueryData(queryKeys.penyusunWorkbench(detailSopId), data)
    },
  })
}

export function usePelaksana(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pelaksanaByWorkspace(workspaceId ?? ''),
    queryFn: async () => {
      const response = await apiClient.get<
        ApiSuccessResponse<Array<{ id: string; workspaceId: string; namaPelaksana: string }>>
      >(`/pelaksana${buildQueryString({ workspaceId })}`)
      return response.data
    },
    enabled: Boolean(workspaceId),
  })
}
