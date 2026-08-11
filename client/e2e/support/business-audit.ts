import { expect, type APIRequestContext } from '@playwright/test'

import { apiGet } from './api'

interface PengajuanAudit {
  id: string
  status: string
  alasanPenolakan?: string
  sopList?: Array<{
    sopDetailId: string
    status: string
    hasil?: string
  }>
  nilaiEvaluasi?: Array<{
    sopDetailId: string
    hasil?: string
    statusTindakLanjut?: string
  }>
}

interface WorkspaceAudit {
  pengajuanAktif?: {
    id: string
    status: string
    nilaiPerDetail?: Array<{
      detailSopId: string
      hasil?: string
      statusTindakLanjut?: string
    }>
  } | null
  daftarSop?: Array<{
    detailSopId: string
    hasilEvaluasi?: string
  }>
}

interface SopWorkbenchAudit {
  detail: {
    id: string
    sopId: string
    status: string
    versi?: number
    judul?: string
    nomorSOP?: string
  }
  tteSignaturePayloadKepalaOpd?: {
    dokumenTteId: string
    userId: string
  }
}

export async function getCurrentPengajuanId(api: APIRequestContext): Promise<string> {
  let resolved: string | null = null
  await expect
    .poll(
      async () => {
        const workspace = await apiGet<WorkspaceAudit>(api, '/evaluasi/workspace/opd-saya')
        resolved = workspace.pengajuanAktif?.id ?? null
        return resolved
      },
      { message: 'pengajuan aktif harus tersedia setelah aksi UI' },
    )
    .not.toBeNull()

  if (resolved === null) throw new Error('Pengajuan aktif tidak ditemukan')
  return resolved
}

export async function expectPengajuanStatus(
  api: APIRequestContext,
  pengajuanId: string,
  status: string,
): Promise<PengajuanAudit> {
  await expect
    .poll(
      async () => (await apiGet<PengajuanAudit>(api, `/evaluasi/${pengajuanId}`)).status,
      { message: `status pengajuan ${pengajuanId} harus ${status}` },
    )
    .toBe(status)
  return apiGet<PengajuanAudit>(api, `/evaluasi/${pengajuanId}`)
}

export async function expectSopStatus(
  api: APIRequestContext,
  detailSopId: string,
  status: string,
): Promise<SopWorkbenchAudit> {
  await expect
    .poll(
      async () =>
        (await apiGet<SopWorkbenchAudit>(api, `/sop/penyusun-workbench/${detailSopId}`)).detail
          .status,
      { message: `status SOP ${detailSopId} harus ${status}` },
    )
    .toBe(status)
  return apiGet<SopWorkbenchAudit>(api, `/sop/penyusun-workbench/${detailSopId}`)
}

export async function expectNilai(
  api: APIRequestContext,
  pengajuanId: string,
  detailSopId: string,
  expected: {
    hasil?: string
    statusTindakLanjut?: string
  },
): Promise<void> {
  await expect
    .poll(async () => {
      const detail = await apiGet<PengajuanAudit>(api, `/evaluasi/${pengajuanId}`)
      const nilai = detail.nilaiEvaluasi?.find((item) => item.sopDetailId === detailSopId)
      return {
        hasil: nilai?.hasil,
        statusTindakLanjut: nilai?.statusTindakLanjut,
      }
    })
    .toMatchObject(expected)
}

export async function expectRejectedEvaluation(
  api: APIRequestContext,
  pengajuanId: string,
  alasan: string,
): Promise<void> {
  const detail = await expectPengajuanStatus(api, pengajuanId, 'DITOLAK')
  expect(detail.alasanPenolakan).toBe(alasan)
}

export async function getWorkbench(
  api: APIRequestContext,
  detailSopId: string,
): Promise<SopWorkbenchAudit> {
  return apiGet<SopWorkbenchAudit>(api, `/sop/penyusun-workbench/${detailSopId}`)
}
