/**
 * Manajemen anggota evaluator Biro — `EvaluatorController` di `/evaluator`.
 */

import { useQuery } from '@tanstack/react-query'
import { apiClient, buildQueryString } from '@/lib/api/api-client'
import { unwrapApiData, unwrapApiVoid } from '@/lib/api/response'
import { queryKeys } from '@/config/query-keys'
import { useMutationWithToast } from '@/hooks/useMutationWithToast'
import { STALE_TIME } from '@/utils/constants'
import type { ApiSuccessResponse } from '@/types/dto/auth.dto'
import type {
  CreateEvaluatorAnggotaDto,
  EvaluatorAnggota,
  EvaluatorOpdGrup,
  UpdateEvaluatorAnggotaDto,
  UpdateEvaluatorAnggotaMutationDto,
} from '@/types/dto/tim.dto'

export const evaluatorAnggotaApi = {
  findAll: async (params?: { search?: string }): Promise<EvaluatorAnggota[]> => {
    const s = params?.search?.trim()
    const qs = buildQueryString(s ? { search: s } : undefined)
    const grup = await unwrapApiData(
      apiClient.get<ApiSuccessResponse<EvaluatorOpdGrup[]>>(`/evaluator${qs}`),
    )
    return grup.flatMap((g) => g.evaluator)
  },

  tambah: (payload: CreateEvaluatorAnggotaDto) =>
    unwrapApiData(
      apiClient.post<ApiSuccessResponse<EvaluatorAnggota>>('/evaluator', payload),
    ),

  update: (id: string, payload: UpdateEvaluatorAnggotaDto) =>
    unwrapApiData(
      apiClient.patch<ApiSuccessResponse<EvaluatorAnggota>>(
        `/evaluator/${id}`,
        payload,
      ),
    ),

  hapus: async (id: string): Promise<void> => {
    await unwrapApiVoid(apiClient.delete<ApiSuccessResponse<null>>(`/evaluator/${id}`))
  },
}

export function useEvaluatorAnggota(search?: string) {
  const searchKey = search?.trim() ?? ''
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.evaluatorAnggotaList(searchKey || undefined),
    queryFn: () =>
      evaluatorAnggotaApi.findAll(
        searchKey ? { search: searchKey } : undefined,
      ),
    staleTime: STALE_TIME.MEDIUM,
  })

  const tambahMutation = useMutationWithToast({
    mutationFn: (payload: CreateEvaluatorAnggotaDto) =>
      evaluatorAnggotaApi.tambah(payload),
    invalidateKeys: [queryKeys.evaluatorAnggota, queryKeys.evaluasi],
    successMessage: 'Anggota evaluator berhasil ditambahkan',
    errorMessagePrefix: 'Gagal menambahkan anggota',
  })

  const updateMutation = useMutationWithToast({
    mutationFn: ({ id, payload }: UpdateEvaluatorAnggotaMutationDto) =>
      evaluatorAnggotaApi.update(id, payload),
    invalidateKeys: [queryKeys.evaluatorAnggota, queryKeys.evaluasi],
    successMessage: 'Data anggota berhasil diperbarui',
    errorMessagePrefix: 'Gagal memperbarui anggota',
  })

  const hapusMutation = useMutationWithToast({
    mutationFn: (id: string) => evaluatorAnggotaApi.hapus(id),
    invalidateKeys: [queryKeys.evaluatorAnggota, queryKeys.evaluasi],
    successMessage: 'Anggota evaluator berhasil dinonaktifkan',
    errorMessagePrefix: 'Gagal menonaktifkan anggota',
  })

  return {
    list: data ?? [],
    isLoading,
    error,
    tambah: tambahMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    hapus: hapusMutation.mutateAsync,
    isAdding: tambahMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: hapusMutation.isPending,
  }
}
