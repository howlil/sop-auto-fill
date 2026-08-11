import { apiClient, buildQueryString } from '@/lib/api/api-client'
import { unwrapApiData } from '@/lib/api/response'
import type { ApiSuccessResponse } from '@/types/dto/auth.dto'
import type {
  BeritaAcaraEvaluasiView,
  CreatePengajuanEvaluasiDto,
  EvaluasiGrafikTahunanData,
  EvaluasiGrafikTahunanQueryParams,
  EvaluasiListQueryParams,
  EvaluasiRingkasQueryParams,
  EvaluasiWorkspaceOpdResponse,
  EvaluasiWorkspaceQueryParams,
  IsiNilaiEvaluasiDto,
  NilaiEvaluasi,
  PengajuanEvaluasi,
  PengajuanEvaluasiRingkasPage,
  PengajuanEvaluasiShell,
  PengajuanSopWorkbenchResponse,
  SelesaiEvaluasiDto,
  TolakPengajuanEvaluasiDto,
  UmpanBalikEvaluasiDetail,
} from '@/types/dto/evaluasi.dto'

async function unwrapEvaluasiWorkspaceOpd(
  promise: Promise<ApiSuccessResponse<EvaluasiWorkspaceOpdResponse>>,
): Promise<EvaluasiWorkspaceOpdResponse> {
  return unwrapApiData(promise)
}

async function unwrapEvaluasiEnvelope<T>(
  promise: Promise<ApiSuccessResponse<T>>,
): Promise<T> {
  return unwrapApiData(promise)
}

function appendEvaluasiListQuery(searchParams: URLSearchParams, params: EvaluasiListQueryParams): void {
  if (params.opdId !== undefined) searchParams.set('opdId', params.opdId)
  if (params.status !== undefined) searchParams.set('status', params.status)
  if (params.jenis !== undefined) searchParams.set('jenis', params.jenis)
  if (params.statusIn !== undefined) {
    for (const status of params.statusIn) {
      if (status != null && String(status).trim() !== '') searchParams.append('statusIn', String(status).trim())
    }
  }
}

function buildEvaluasiRingkasQueryString(params: EvaluasiRingkasQueryParams): string {
  const searchParams = new URLSearchParams()
  if (params.page !== undefined) searchParams.set('page', String(params.page))
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit))
  if (params.opdId !== undefined) searchParams.set('opdId', params.opdId)
  if (params.status !== undefined) searchParams.set('status', params.status)
  if (params.jenis !== undefined) searchParams.set('jenis', params.jenis)
  if (params.search !== undefined && params.search.trim() !== '') {
    searchParams.set('search', params.search.trim())
  }
  if (params.statusIn !== undefined) {
    for (const status of params.statusIn) {
      if (status != null && String(status).trim() !== '') searchParams.append('statusIn', String(status).trim())
    }
  }
  const qs = searchParams.toString()
  return qs !== '' ? `?${qs}` : ''
}

export const evaluasiApi = {
  findAll: (params?: EvaluasiListQueryParams) => {
    let query = ''
    if (params !== undefined && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams()
      appendEvaluasiListQuery(searchParams, params)
      const qs = searchParams.toString()
      query = qs !== '' ? `?${qs}` : ''
    }
    return unwrapEvaluasiEnvelope(
      apiClient.get<ApiSuccessResponse<PengajuanEvaluasi[]>>(`/evaluasi${query}`),
    )
  },

  findById: (id: string) =>
    unwrapEvaluasiEnvelope(apiClient.get<ApiSuccessResponse<PengajuanEvaluasi>>(`/evaluasi/${id}`)),

  findPengajuanShell: (id: string) =>
    unwrapEvaluasiEnvelope(
      apiClient.get<ApiSuccessResponse<PengajuanEvaluasiShell>>(`/evaluasi/pengajuan/${id}`),
    ),

  findPengajuanSopDokumen: (
    pengajuanId: string,
    detailSopId: string,
    logsLimit?: number,
    opts?: { arsip?: boolean },
  ) => {
    const params = new URLSearchParams()
    if (logsLimit !== undefined) params.set('logsLimit', String(logsLimit))
    if (opts?.arsip === true) params.set('arsip', 'true')
    const qs = params.toString()
    return unwrapEvaluasiEnvelope(
      apiClient.get<ApiSuccessResponse<PengajuanSopWorkbenchResponse>>(
        `/evaluasi/pengajuan/${pengajuanId}/sop-dokumen/${detailSopId}${qs ? `?${qs}` : ''}`,
      ),
    )
  },

  findPengajuanBeritaAcara: (pengajuanId: string, opts?: { arsip?: boolean }) => {
    const qs = opts?.arsip === true ? '?arsip=true' : ''
    return unwrapEvaluasiEnvelope(
      apiClient.get<ApiSuccessResponse<BeritaAcaraEvaluasiView>>(
        `/evaluasi/pengajuan/${pengajuanId}/berita-acara${qs}`,
      ),
    )
  },

  create: (payload: CreatePengajuanEvaluasiDto) =>
    unwrapEvaluasiEnvelope(
      apiClient.post<ApiSuccessResponse<PengajuanEvaluasi>>('/evaluasi', payload),
    ),

  isiNilai: (
    pengajuanEvaluasiId: string,
    sopDetailId: string,
    payload: IsiNilaiEvaluasiDto,
  ) =>
    unwrapEvaluasiEnvelope(
      apiClient.patch<ApiSuccessResponse<NilaiEvaluasi>>(
        `/evaluasi/${pengajuanEvaluasiId}/nilai/${sopDetailId}`,
        payload,
      ),
    ),

  getUmpanBalikEvaluasi: (detailSopId: string) =>
    unwrapEvaluasiEnvelope(
      apiClient.get<ApiSuccessResponse<UmpanBalikEvaluasiDetail | null>>(
        `/evaluasi/umpan-balik/detail/${detailSopId}`,
      ),
    ),

  tandaiTindakLanjutSelesai: (pengajuanEvaluasiId: string, detailSopId: string) =>
    unwrapEvaluasiEnvelope(
      apiClient.patch<ApiSuccessResponse<NilaiEvaluasi>>(
        `/evaluasi/${pengajuanEvaluasiId}/nilai/${detailSopId}/tindak-lanjut-selesai`,
      ),
    ),

  selesai: (
    pengajuanEvaluasiId: string,
    payload: SelesaiEvaluasiDto,
  ) =>
    unwrapEvaluasiEnvelope(
      apiClient.patch<ApiSuccessResponse<PengajuanEvaluasi>>(
        `/evaluasi/${pengajuanEvaluasiId}/selesai`,
        payload,
      ),
    ),

  tolak: (pengajuanEvaluasiId: string, payload: TolakPengajuanEvaluasiDto) =>
    unwrapEvaluasiEnvelope(
      apiClient.patch<ApiSuccessResponse<PengajuanEvaluasi>>(
        `/evaluasi/${pengajuanEvaluasiId}/tolak`,
        payload,
      ),
    ),

  grafikTahunan: async (params?: EvaluasiGrafikTahunanQueryParams) => {
    const envelope = await apiClient.get<ApiSuccessResponse<EvaluasiGrafikTahunanData>>(
      `/evaluasi/laporan/grafik-tahunan${buildQueryString(params as Record<string, unknown> | undefined)}`,
    )
    return envelope.data
  },

  workspaceOpd: (opdId: string, params?: EvaluasiWorkspaceQueryParams) =>
    unwrapEvaluasiWorkspaceOpd(
      apiClient.get<ApiSuccessResponse<EvaluasiWorkspaceOpdResponse>>(
        `/evaluasi/workspace/opd/${opdId}${buildQueryString(params as Record<string, unknown> | undefined)}`,
      ),
    ),

  workspaceOpdSaya: (params?: EvaluasiWorkspaceQueryParams) =>
    unwrapEvaluasiWorkspaceOpd(
      apiClient.get<ApiSuccessResponse<EvaluasiWorkspaceOpdResponse>>(
        `/evaluasi/workspace/opd-saya${buildQueryString(params as Record<string, unknown> | undefined)}`,
      ),
    ),

  workspacePengajuan: (pengajuanEvaluasiId: string, params?: EvaluasiWorkspaceQueryParams) =>
    unwrapEvaluasiWorkspaceOpd(
      apiClient.get<ApiSuccessResponse<EvaluasiWorkspaceOpdResponse>>(
        `/evaluasi/workspace/pengajuan/${pengajuanEvaluasiId}${buildQueryString(params as Record<string, unknown> | undefined)}`,
      ),
    ),

  findRingkas: (params?: EvaluasiRingkasQueryParams) =>
    unwrapEvaluasiEnvelope(
      apiClient.get<ApiSuccessResponse<PengajuanEvaluasiRingkasPage>>(
        `/evaluasi/ringkas${buildEvaluasiRingkasQueryString(params ?? {})}`,
      ),
    ),
}
