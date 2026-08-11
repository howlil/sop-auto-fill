/**
 * Manajemen penyusun — relatif ke base `/api/v1` → `GET/POST /penyusun`, dll.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, buildQueryString } from '@/lib/api/api-client'
import { unwrapApiData, unwrapApiVoid } from '@/lib/api/response'
import { queryKeys } from '@/config/query-keys'
import { useMutationWithToast } from '@/hooks/useMutationWithToast'
import { STALE_TIME } from '@/utils/constants'
import type { ApiSuccessResponse } from '@/types/dto/auth.dto'
import type {
  CreatePenggunaPenyusunDto,
  PindahTimPenyusunDto,
  PindahTimPenyusunMutationDto,
  PenyusunPublikItem,
  RiwayatOpdPenyusunItem,
  TimPenyusunOpdGrup,
  UpdatePenyusunMutationDto,
  UpdatePenggunaPenyusunDto,
} from '@/types/dto/tim.dto'

export const penyusunApi = {
  findAllGrup: (params?: { search?: string }): Promise<TimPenyusunOpdGrup[]> => {
    const s = params?.search?.trim()
    const qs = buildQueryString(s ? { search: s } : undefined)
    return unwrapApiData(
      apiClient.get<ApiSuccessResponse<TimPenyusunOpdGrup[]>>(`/penyusun${qs}`),
    )
  },

  create: (payload: CreatePenggunaPenyusunDto): Promise<PenyusunPublikItem> =>
    unwrapApiData(apiClient.post<ApiSuccessResponse<PenyusunPublikItem>>('/penyusun', payload)),

  update: (id: string, payload: UpdatePenggunaPenyusunDto): Promise<PenyusunPublikItem> =>
    unwrapApiData(apiClient.patch<ApiSuccessResponse<PenyusunPublikItem>>(`/penyusun/${id}`, payload)),

  nonaktifkan: async (id: string): Promise<void> => {
    await unwrapApiVoid(apiClient.patch<ApiSuccessResponse<null>>(`/penyusun/${id}/nonaktifkan`))
  },

  aktifkan: (id: string): Promise<PenyusunPublikItem> =>
    unwrapApiData(apiClient.patch<ApiSuccessResponse<PenyusunPublikItem>>(`/penyusun/${id}/aktifkan`)),

  pindah: (id: string, payload: PindahTimPenyusunDto): Promise<PenyusunPublikItem> =>
    unwrapApiData(
      apiClient.patch<ApiSuccessResponse<PenyusunPublikItem>>(
        `/penyusun/${id}/pindah`,
        payload,
      ),
    ),

  hapusPermanen: async (id: string): Promise<void> => {
    await unwrapApiVoid(apiClient.delete<ApiSuccessResponse<null>>(`/penyusun/${id}`))
  },

  getRiwayatOpd: (id: string): Promise<RiwayatOpdPenyusunItem[]> =>
    unwrapApiData(
      apiClient.get<ApiSuccessResponse<RiwayatOpdPenyusunItem[]>>(
        `/penyusun/${id}/riwayat-opd`,
      ),
    ),
}

export function usePenyusun(search?: string) {
  const queryClient = useQueryClient()
  const searchKey = search?.trim() ?? ''

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.penyusunGrup(searchKey || undefined),
    queryFn: () =>
      penyusunApi.findAllGrup(searchKey ? { search: searchKey } : undefined),
    staleTime: STALE_TIME.MEDIUM,
  })

  const invalidateRiwayatUntuk = (penggunaId: string) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.penyusunRiwayatOpd(penggunaId),
    })
  }

  const createMutation = useMutationWithToast({
    mutationFn: (payload: CreatePenggunaPenyusunDto) => penyusunApi.create(payload),
    invalidateKeys: [queryKeys.penyusun, queryKeys.sop, queryKeys.evaluasi],
    successMessage: 'Penyusun berhasil ditambahkan',
    errorMessagePrefix: 'Gagal menambahkan penyusun',
    onSuccess: (created) => invalidateRiwayatUntuk(created.id),
  })

  const updateMutation = useMutationWithToast({
    mutationFn: ({ id, payload }: UpdatePenyusunMutationDto) => penyusunApi.update(id, payload),
    invalidateKeys: [queryKeys.penyusun, queryKeys.sop, queryKeys.evaluasi],
    successMessage: 'Data penyusun berhasil diperbarui',
    errorMessagePrefix: 'Gagal memperbarui penyusun',
  })

  const nonaktifkanMutation = useMutationWithToast({
    mutationFn: (id: string) => penyusunApi.nonaktifkan(id),
    invalidateKeys: [queryKeys.penyusun, queryKeys.sop, queryKeys.evaluasi],
    successMessage: 'Penyusun dinonaktifkan',
    errorMessagePrefix: 'Gagal menonaktifkan penyusun',
    onSuccess: (_void, id) => invalidateRiwayatUntuk(id),
  })

  const aktifkanMutation = useMutationWithToast({
    mutationFn: (id: string) => penyusunApi.aktifkan(id),
    invalidateKeys: [queryKeys.penyusun, queryKeys.sop, queryKeys.evaluasi],
    successMessage: 'Penyusun diaktifkan kembali',
    errorMessagePrefix: 'Gagal mengaktifkan penyusun',
    onSuccess: (row) => invalidateRiwayatUntuk(row.id),
  })

  const pindahMutation = useMutationWithToast({
    mutationFn: ({ id, opdId }: PindahTimPenyusunMutationDto) =>
      penyusunApi.pindah(id, { opdId }),
    invalidateKeys: [queryKeys.penyusun, queryKeys.sop, queryKeys.evaluasi],
    successMessage: 'Penyusun berhasil dipindahkan',
    errorMessagePrefix: 'Gagal memindahkan penyusun',
    onSuccess: (_data, vars) => invalidateRiwayatUntuk(vars.id),
  })

  const hapusPermanenMutation = useMutationWithToast({
    mutationFn: (id: string) => penyusunApi.hapusPermanen(id),
    invalidateKeys: [queryKeys.penyusun, queryKeys.sop, queryKeys.evaluasi],
    successMessage: 'Penyusun berhasil dihapus permanen',
    errorMessagePrefix: 'Gagal menghapus penyusun',
    onSuccess: (_void, id) => invalidateRiwayatUntuk(id),
  })

  return {
    grup: data ?? [],
    isLoading,
    error,
    tambah: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    nonaktifkan: nonaktifkanMutation.mutateAsync,
    aktifkan: aktifkanMutation.mutateAsync,
    pindah: pindahMutation.mutateAsync,
    hapusPermanen: hapusPermanenMutation.mutateAsync,
    isAdding: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isNonaktifkan: nonaktifkanMutation.isPending,
    isAktifkan: aktifkanMutation.isPending,
    isPindah: pindahMutation.isPending,
    isDeletingPermanent: hapusPermanenMutation.isPending,
  }
}
