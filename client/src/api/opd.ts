/**
 * OPD API service — selaras server OpdController (/opd).
 */

import { useQuery } from '@tanstack/react-query'
import { apiClient, buildQueryString } from '@/lib/api/api-client'
import { unwrapApiData, unwrapApiVoid } from '@/lib/api/response'
import { queryKeys } from '@/config/query-keys'
import { useMutationWithToast } from '@/hooks/useMutationWithToast'
import { STALE_TIME } from '@/utils/constants'
import type { ApiSuccessResponse } from '@/types/dto/auth.dto'
import type {
  CreateOpdDto,
  OpdMutasi,
  OpdRingkas,
  UpdateOpdDto,
  UpdateOpdMutationDto,
} from '@/types/dto/opd.dto'

export const opdApi = {
  /** Daftar OPD ringkas (peran menentukan ruang lingkup). */
  findAll: async (params?: { search?: string }): Promise<OpdRingkas[]> => {
    const s = params?.search?.trim()
    const qs = buildQueryString(s ? { search: s } : undefined)
    return unwrapApiData(apiClient.get<ApiSuccessResponse<OpdRingkas[]>>(`/opd${qs}`))
  },

  /** Buat OPD (PJ_EVALUATOR). */
  create: (payload: CreateOpdDto): Promise<OpdMutasi> =>
    unwrapApiData(apiClient.post<ApiSuccessResponse<OpdMutasi>>('/opd', payload)),

  /** Perbarui nama OPD (PJ_EVALUATOR). */
  update: (id: string, payload: UpdateOpdDto): Promise<OpdMutasi> =>
    unwrapApiData(apiClient.patch<ApiSuccessResponse<OpdMutasi>>(`/opd/${id}`, payload)),

  /** Soft-delete OPD (PJ_EVALUATOR). */
  delete: async (id: string): Promise<void> => {
    await unwrapApiVoid(apiClient.delete<ApiSuccessResponse<null>>(`/opd/${id}`))
  },

}

export interface UseOpdOptions {
  /** Filter nama OPD (substring); relevan untuk PJ_EVALUATOR. */
  readonly search?: string
}

export function useOpd(options?: UseOpdOptions) {
  const searchKey = options?.search?.trim() ?? ''
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.opdList(searchKey || undefined),
    queryFn: () =>
      opdApi.findAll(searchKey ? { search: searchKey } : undefined),
    staleTime: STALE_TIME.MEDIUM,
  })
  const list = data ?? []

  const createMutation = useMutationWithToast({
    mutationFn: (payload: CreateOpdDto) => opdApi.create(payload),
    invalidateKeys: [
      queryKeys.opd,
      queryKeys.kepalaOpd,
      queryKeys.penyusun,
      queryKeys.evaluatorAnggota,
      queryKeys.sop,
      queryKeys.evaluasi,
    ],
    successMessage: 'OPD berhasil ditambahkan',
    errorMessagePrefix: 'Gagal menambahkan OPD',
  })

  const updateMutation = useMutationWithToast({
    mutationFn: ({ id, payload }: UpdateOpdMutationDto) =>
      opdApi.update(id, payload),
    invalidateKeys: [
      queryKeys.opd,
      queryKeys.kepalaOpd,
      queryKeys.penyusun,
      queryKeys.evaluatorAnggota,
      queryKeys.sop,
      queryKeys.evaluasi,
    ],
    successMessage: 'OPD berhasil diperbarui',
    errorMessagePrefix: 'Gagal memperbarui OPD',
  })

  const deleteMutation = useMutationWithToast({
    mutationFn: (id: string) => opdApi.delete(id),
    invalidateKeys: [
      queryKeys.opd,
      queryKeys.kepalaOpd,
      queryKeys.penyusun,
      queryKeys.evaluatorAnggota,
      queryKeys.sop,
      queryKeys.evaluasi,
    ],
    successMessage: 'OPD berhasil dinonaktifkan',
    errorMessagePrefix: 'Gagal menonaktifkan OPD',
  })

  return {
    list,
    isLoading,
    error,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
