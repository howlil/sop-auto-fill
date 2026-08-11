import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { apiClient, buildQueryString } from '@/lib/api/api-client'
import { unwrapApiData, unwrapApiVoid } from '@/lib/api/response'
import { queryKeys } from '@/config/query-keys'
import { useMutationWithToast } from '@/hooks/useMutationWithToast'
import { STALE_TIME } from '@/utils/constants'
import type { ApiSuccessResponse } from '@/types/dto/auth.dto'
import type {
  CreateKepalaOpdDto,
  KepalaOpdDto,
  KepalaOpdRiwayatItemDto,
  UpdateKepalaOpdDto,
} from '@/types/dto/kepala-opd.dto'

export const kepalaOpdApi = {
  findAll: (params?: { search?: string }): Promise<KepalaOpdDto[]> => {
    const search = params?.search?.trim()
    const qs = buildQueryString(search ? { search } : undefined)
    return unwrapApiData(apiClient.get<ApiSuccessResponse<KepalaOpdDto[]>>(`/kepala-opd${qs}`))
  },

  create: (payload: CreateKepalaOpdDto): Promise<KepalaOpdDto> =>
    unwrapApiData(apiClient.post<ApiSuccessResponse<KepalaOpdDto>>('/kepala-opd', payload)),

  update: (id: string, payload: UpdateKepalaOpdDto): Promise<KepalaOpdDto> =>
    unwrapApiData(apiClient.patch<ApiSuccessResponse<KepalaOpdDto>>(`/kepala-opd/${id}`, payload)),

  remove: async (id: string): Promise<void> => {
    await unwrapApiVoid(apiClient.delete<ApiSuccessResponse<null>>(`/kepala-opd/${id}`))
  },

  riwayatOpd: (id: string): Promise<KepalaOpdRiwayatItemDto[]> =>
    unwrapApiData(
      apiClient.get<ApiSuccessResponse<KepalaOpdRiwayatItemDto[]>>(
        `/kepala-opd/${id}/riwayat-opd`,
      ),
    ),
}

export function useKepalaOpdList(
  search?: string,
  options?: Pick<UseQueryOptions<KepalaOpdDto[]>, 'enabled'>,
) {
  const searchKey = search?.trim() ?? ''
  return useQuery({
    queryKey: queryKeys.kepalaOpdList(searchKey || undefined),
    queryFn: () =>
      kepalaOpdApi.findAll(searchKey ? { search: searchKey } : undefined),
    staleTime: STALE_TIME.MEDIUM,
    enabled: options?.enabled ?? true,
  })
}

export function useKepalaOpdRiwayat(penggunaId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.kepalaOpdRiwayat(penggunaId ?? ''),
    queryFn: () => kepalaOpdApi.riwayatOpd(penggunaId!),
    enabled: enabled && !!penggunaId,
    staleTime: STALE_TIME.MEDIUM,
  })
}

export function useCreateKepalaOpd() {
  return useMutationWithToast({
    mutationFn: (payload: CreateKepalaOpdDto) => kepalaOpdApi.create(payload),
    invalidateKeys: [
      queryKeys.kepalaOpd,
      queryKeys.opd,
      queryKeys.users,
      queryKeys.sop,
      queryKeys.evaluasi,
    ],
    successMessage: 'Kepala OPD berhasil ditambahkan',
    errorMessagePrefix: 'Gagal menambahkan Kepala OPD',
  })
}

export function useUpdateKepalaOpd() {
  return useMutationWithToast({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateKepalaOpdDto }) =>
      kepalaOpdApi.update(id, payload),
    invalidateKeys: [
      queryKeys.kepalaOpd,
      queryKeys.opd,
      queryKeys.users,
      queryKeys.sop,
      queryKeys.evaluasi,
    ],
    successMessage: 'Data Kepala OPD berhasil diperbarui',
    errorMessagePrefix: 'Gagal memperbarui Kepala OPD',
  })
}

export function useDeleteKepalaOpd() {
  return useMutationWithToast({
    mutationFn: (id: string) => kepalaOpdApi.remove(id),
    invalidateKeys: [
      queryKeys.kepalaOpd,
      queryKeys.opd,
      queryKeys.users,
      queryKeys.sop,
      queryKeys.evaluasi,
    ],
    successMessage: 'Kepala OPD berhasil dihapus',
    errorMessagePrefix: 'Gagal menghapus Kepala OPD',
  })
}
