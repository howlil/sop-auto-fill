import { apiClient, buildQueryString } from '@/lib/api/api-client'
import { unwrapApiData } from '@/lib/api/response'
import type { ApiSuccessResponse } from '@/types/dto/auth.dto'
import type {
  CreatePelaksanaDto,
  CreateSopRequestDto,
  Pelaksana,
  PenyusunWorkbenchData,
  PenyusunWorkbenchQueryParams,
  SopDaftarRow,
  SopListQueryParams,
  SopRiwayatVersiRow,
  UpdateSopHeaderDto,
  UpdateSopProsedurDto,
  UpdateSopDiagramDto,
  UpdateStatusDto,
} from '@/types/dto/sop.dto'

async function unwrapPelaksanaMaster<T>(promise: Promise<ApiSuccessResponse<T>>): Promise<T> {
  return unwrapApiData(promise)
}

async function unwrapSopListEnvelope(
  promise: Promise<ApiSuccessResponse<SopDaftarRow[]>>,
): Promise<SopDaftarRow[]> {
  return unwrapApiData(promise)
}

async function unwrapSopCreateEnvelope(
  promise: Promise<ApiSuccessResponse<SopDaftarRow>>,
): Promise<SopDaftarRow> {
  return unwrapApiData(promise)
}

async function unwrapPenyusunWorkbench(
  promise: Promise<ApiSuccessResponse<PenyusunWorkbenchData>>,
): Promise<PenyusunWorkbenchData> {
  return unwrapApiData(promise)
}

export const sopApi = {
  findAll: (params?: SopListQueryParams) => {
    const query = buildQueryString(params as Record<string, unknown> | undefined)
    return unwrapSopListEnvelope(
      apiClient.get<ApiSuccessResponse<SopDaftarRow[]>>(`/sop${query}`),
    )
  },

  create: (payload: CreateSopRequestDto) =>
    unwrapSopCreateEnvelope(
      apiClient.post<ApiSuccessResponse<SopDaftarRow>>('/sop', payload),
    ),

  getPenyusunWorkbench: (detailSopId: string, params?: PenyusunWorkbenchQueryParams) => {
    const query = buildQueryString(params as Record<string, unknown> | undefined)
    return unwrapPenyusunWorkbench(
      apiClient.get<ApiSuccessResponse<PenyusunWorkbenchData>>(
        `/sop/penyusun-workbench/${detailSopId}${query}`,
      ),
    )
  },

  updateSopHeader: (detailSopId: string, payload: UpdateSopHeaderDto) =>
    unwrapPenyusunWorkbench(
      apiClient.patch<ApiSuccessResponse<PenyusunWorkbenchData>>(
        `/sop/header/${detailSopId}`,
        payload,
      ),
    ),

  updateSopProsedur: (detailSopId: string, payload: UpdateSopProsedurDto) =>
    unwrapPenyusunWorkbench(
      apiClient.patch<ApiSuccessResponse<PenyusunWorkbenchData>>(
        `/sop/langkah/${detailSopId}`,
        payload,
      ),
    ),

  updateSopDiagram: (detailSopId: string, payload: UpdateSopDiagramDto) =>
    unwrapPenyusunWorkbench(
      apiClient.patch<ApiSuccessResponse<PenyusunWorkbenchData>>(
        `/sop/diagram/${detailSopId}`,
        payload,
      ),
    ),

  updateStatus: (id: string, payload: UpdateStatusDto) =>
    unwrapPenyusunWorkbench(
      apiClient.patch<ApiSuccessResponse<PenyusunWorkbenchData>>(`/sop/status/${id}`, payload),
    ),

  cabutSop: (id: string, params?: PenyusunWorkbenchQueryParams) => {
    const query = buildQueryString(params as Record<string, unknown> | undefined)
    return unwrapPenyusunWorkbench(
      apiClient.post<ApiSuccessResponse<PenyusunWorkbenchData>>(`/sop/cabut/${id}${query}`),
    )
  },

  kirimUlangEvaluasiSetelahRevisi: (detailSopId: string, params?: PenyusunWorkbenchQueryParams) => {
    const query = buildQueryString(params as Record<string, unknown> | undefined)
    return unwrapPenyusunWorkbench(
      apiClient.post<ApiSuccessResponse<PenyusunWorkbenchData>>(
        `/sop/penyusun-workbench/${detailSopId}/kirim-ulang-evaluasi${query}`,
      ),
    )
  },

  buatVersiBaru: (detailSopId: string, params?: PenyusunWorkbenchQueryParams) => {
    const query = buildQueryString(params as Record<string, unknown> | undefined)
    return unwrapPenyusunWorkbench(
      apiClient.post<ApiSuccessResponse<PenyusunWorkbenchData>>(
        `/sop/${detailSopId}/buat-versi-baru${query}`,
      ),
    )
  },

  getRiwayatVersi: (sopId: string) =>
    unwrapApiData(
      apiClient.get<ApiSuccessResponse<SopRiwayatVersiRow[]>>(`/sop/${sopId}/riwayat-versi`),
    ),

  hapusVersiDraft: (detailSopId: string) =>
    unwrapApiData(
      apiClient.delete<ApiSuccessResponse<null>>(`/sop/${detailSopId}/versi-draft`),
    ),

  hapusSopDraftAwal: (detailSopId: string) =>
    unwrapApiData(
      apiClient.delete<ApiSuccessResponse<null>>(`/sop/${detailSopId}/draft`),
    ),

  findPelaksana: (opdId: string) =>
    unwrapPelaksanaMaster(
      apiClient.get<ApiSuccessResponse<Pelaksana[]>>(`/pelaksana?opdId=${encodeURIComponent(opdId)}`),
    ),

  createPelaksana: (payload: CreatePelaksanaDto) =>
    unwrapPelaksanaMaster(apiClient.post<ApiSuccessResponse<Pelaksana>>('/pelaksana', payload)),

  updatePelaksana: (id: string, namaPelaksana: string) =>
    unwrapPelaksanaMaster(
      apiClient.patch<ApiSuccessResponse<Pelaksana>>(`/pelaksana/${id}`, { namaPelaksana }),
    ),

  deletePelaksana: (id: string) =>
    unwrapPelaksanaMaster(apiClient.delete<ApiSuccessResponse<null>>(`/pelaksana/${id}`)),
}
