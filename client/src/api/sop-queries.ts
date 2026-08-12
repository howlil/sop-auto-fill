import { useMemo } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { queryKeys } from '@/config/query-keys'
import { useMutationWithToast } from '@/hooks/useMutationWithToast'
import { STALE_TIME } from '@/utils/constants'
import { sopApi } from '@/api/sop-client'
import type { CreateSopRequestDto, SopDaftarRow, SopListQueryParams } from '@/types/dto/sop.dto'

function sopListQueryOptions(params?: SopListQueryParams) {
  return {
    queryKey: queryKeys.sopList(params),
    queryFn: () => sopApi.findAll(params),
    staleTime: STALE_TIME.SHORT,
  } as const
}

export function useSopListSuspenseQuery(params?: SopListQueryParams) {
  return useSuspenseQuery<SopDaftarRow[]>({ ...sopListQueryOptions(params) })
}

export function useSop(params?: SopListQueryParams) {
  const { data: list = [], isLoading, error } = useQuery<SopDaftarRow[]>({
    ...sopListQueryOptions(params),
    enabled: Boolean(params?.workspaceId),
  })
  return { list, isLoading, error }
}

export function useSopSuspense(params?: SopListQueryParams) {
  const { data: list } = useSuspenseQuery<SopDaftarRow[]>({ ...sopListQueryOptions(params) })
  const createMutation = useMutationWithToast({
    mutationFn: (payload: CreateSopRequestDto) => sopApi.create(payload),
    invalidateKeys: [queryKeys.sop],
    successMessage: 'SOP berhasil dibuat',
    errorMessagePrefix: 'Gagal membuat SOP',
  })
  return {
    list,
    isLoading: false,
    error: undefined,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  }
}

export function usePenyusunWorkbench(detailSopId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.penyusunWorkbench(detailSopId ?? ''),
    queryFn: () => sopApi.getPenyusunWorkbench(detailSopId!),
    enabled: Boolean(detailSopId),
    staleTime: STALE_TIME.SHORT,
  })
}

export function useRiwayatVersi(detailSopId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sopRiwayatVersi(detailSopId ?? ''),
    queryFn: () => sopApi.getRiwayatVersi(detailSopId!),
    enabled: Boolean(detailSopId),
    staleTime: STALE_TIME.SHORT,
  })
}

export interface UseDaftarSopDataParams {
  list: SopDaftarRow[]
  searchQuery: string
}

export function useDaftarSopData(params: UseDaftarSopDataParams) {
  const filteredList = useMemo(() => {
    const query = params.searchQuery.trim().toLowerCase()
    if (!query) return params.list
    return params.list.filter(
      (sop) =>
        sop.judul.toLowerCase().includes(query) ||
        (sop.nomorSop ?? '').toLowerCase().includes(query) ||
        (sop.pembuat ?? '').toLowerCase().includes(query),
    )
  }, [params.list, params.searchQuery])
  return { filteredList }
}
