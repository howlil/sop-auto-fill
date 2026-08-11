import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/config/query-keys'
import { apiClient, buildQueryString } from '@/lib/api/api-client'
import { unwrapApiData } from '@/lib/api/response'
import { SOP_EVALUASI_WORKFLOW_REFRESH_OPTIONS } from '@/lib/api/cache-invalidation'
import type { ApiSuccessResponse } from '@/types/dto/auth.dto'
import type {
  PublicArsipQueryParams,
  PublicOpdPage,
  PublicSopByOpdPage,
  PublicSopDokumen,
  PublicSopPage,
} from '@/types/dto/sop-public.dto'

export const sopPublicApi = {
  listOpd: (params?: PublicArsipQueryParams) =>
    unwrapApiData<PublicOpdPage>(
      apiClient.get<ApiSuccessResponse<PublicOpdPage>>(
        `/sop/public/opd${buildQueryString(params as Record<string, unknown> | undefined)}`,
      ),
    ),

  listSopByOpd: (opdId: string, params?: PublicArsipQueryParams) =>
    unwrapApiData<PublicSopByOpdPage>(
      apiClient.get<ApiSuccessResponse<PublicSopByOpdPage>>(
        `/sop/public/opd/${encodeURIComponent(opdId)}/sop${buildQueryString(params as Record<string, unknown> | undefined)}`,
      ),
    ),

  listSopGlobal: (params?: PublicArsipQueryParams) =>
    unwrapApiData<PublicSopPage>(
      apiClient.get<ApiSuccessResponse<PublicSopPage>>(
        `/sop/public/sop${buildQueryString(params as Record<string, unknown> | undefined)}`,
      ),
    ),

  getDokumen: (detailSopId: string) =>
    unwrapApiData<PublicSopDokumen>(
      apiClient.get<ApiSuccessResponse<PublicSopDokumen>>(
        `/sop/public/dokumen/${encodeURIComponent(detailSopId)}`,
      ),
    ),
}

export function usePublicOpdList(params: PublicArsipQueryParams) {
  return useQuery({
    queryKey: queryKeys.sopPublicOpdList(params),
    queryFn: () => sopPublicApi.listOpd(params),
    ...SOP_EVALUASI_WORKFLOW_REFRESH_OPTIONS,
  })
}

export function usePublicSopList(opdId: string, params: PublicArsipQueryParams) {
  return useQuery({
    queryKey: queryKeys.sopPublicSopList(opdId, params),
    queryFn: () => sopPublicApi.listSopByOpd(opdId, params),
    enabled: Boolean(opdId),
    ...SOP_EVALUASI_WORKFLOW_REFRESH_OPTIONS,
  })
}

export function usePublicSopGlobalList(params: PublicArsipQueryParams) {
  return useQuery({
    queryKey: queryKeys.sopPublicSopGlobal(params),
    queryFn: () => sopPublicApi.listSopGlobal(params),
    enabled: Boolean(params.search?.trim()),
    ...SOP_EVALUASI_WORKFLOW_REFRESH_OPTIONS,
  })
}

export function usePublicSopDokumen(detailSopId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sopPublicDokumen(detailSopId ?? ''),
    queryFn: () => sopPublicApi.getDokumen(detailSopId!),
    enabled: Boolean(detailSopId),
    ...SOP_EVALUASI_WORKFLOW_REFRESH_OPTIONS,
  })
}
