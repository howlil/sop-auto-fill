import { apiClient, buildQueryString } from '@/lib/api/api-client'
import type { ApiSuccessResponse } from '@/types/dto/auth.dto'
import type {
  CreateSopRequestDto,
  PenyusunWorkbenchResponse,
  SopDaftarRow,
  SopListQueryParams,
  SopRiwayatVersiRow,
  UpdateDetailSopStatusDto,
  UpdateSopDiagramDto,
  UpdateSopHeaderDto,
  UpdateSopProsedurDto,
} from '@/types/dto/sop.dto'

async function unwrap<T>(promise: Promise<ApiSuccessResponse<T>>): Promise<T> {
  return (await promise).data
}

export const sopApi = {
  findAll: (params?: SopListQueryParams) =>
    unwrap(apiClient.get<ApiSuccessResponse<SopDaftarRow[]>>(`/sop${buildQueryString(params)}`)),

  create: (payload: CreateSopRequestDto) =>
    unwrap(apiClient.post<ApiSuccessResponse<SopDaftarRow>>('/sop', payload)),

  getPenyusunWorkbench: (detailSopId: string, logsLimit = 100) =>
    unwrap(
      apiClient.get<ApiSuccessResponse<PenyusunWorkbenchResponse>>(
        `/sop/penyusun-workbench/${detailSopId}?logsLimit=${logsLimit}`,
      ),
    ),

  updateStatus: (detailSopId: string, dto: UpdateDetailSopStatusDto, logsLimit = 100) =>
    unwrap(
      apiClient.patch<ApiSuccessResponse<PenyusunWorkbenchResponse>>(
        `/sop/status/${detailSopId}?logsLimit=${logsLimit}`,
        dto,
      ),
    ),

  updateHeader: (detailSopId: string, dto: UpdateSopHeaderDto, logsLimit = 100) =>
    unwrap(
      apiClient.patch<ApiSuccessResponse<PenyusunWorkbenchResponse>>(
        `/sop/header/${detailSopId}?logsLimit=${logsLimit}`,
        dto,
      ),
    ),

  updateProsedur: (detailSopId: string, dto: UpdateSopProsedurDto, logsLimit = 100) =>
    unwrap(
      apiClient.patch<ApiSuccessResponse<PenyusunWorkbenchResponse>>(
        `/sop/langkah/${detailSopId}?logsLimit=${logsLimit}`,
        dto,
      ),
    ),

  updateDiagram: (detailSopId: string, dto: UpdateSopDiagramDto, logsLimit = 100) =>
    unwrap(
      apiClient.patch<ApiSuccessResponse<PenyusunWorkbenchResponse>>(
        `/sop/diagram/${detailSopId}?logsLimit=${logsLimit}`,
        dto,
      ),
    ),

  getRiwayatVersi: (detailSopId: string) =>
    unwrap(
      apiClient.get<ApiSuccessResponse<SopRiwayatVersiRow[]>>(
        `/sop/${detailSopId}/riwayat-versi`,
      ),
    ),

  buatVersiBaru: (detailSopId: string, logsLimit = 100) =>
    unwrap(
      apiClient.post<ApiSuccessResponse<PenyusunWorkbenchResponse>>(
        `/sop/${detailSopId}/buat-versi-baru?logsLimit=${logsLimit}`,
      ),
    ),

  hapusVersiDraft: (detailSopId: string) => apiClient.delete<void>(`/sop/${detailSopId}/versi-draft`),
  hapusSopDraftAwal: (detailSopId: string) => apiClient.delete<void>(`/sop/${detailSopId}/draft`),
}
