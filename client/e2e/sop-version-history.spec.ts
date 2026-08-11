import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { users } from './fixtures/users'
import {
  apiGet,
  apiPatch,
  apiPost,
  createAuthenticatedApiContext,
  expectBackendAvailable,
  toApiUrl,
} from './support/api'
import { expectMainContent, loginViaUi } from './support/app'
import {
  createApprovedSopFixture,
  createPengajuanForSop,
  ensureTteReady,
  finishEvaluation,
  nilaiSopSesuai,
  signAllSop,
  signBeritaAcara,
  type ApprovedSopFixture,
  type ReadySopFixture,
} from './support/e2e-flow'

interface VersionWorkbench {
  detail: {
    id: string
    sopId: string
    status: string
    versi: number
    nomorSOP: string
    namaLembaga: string
    revisiDariDetailSopId: string | null
    revisiDariVersi: number | null
  }
  logEdit: Array<{ keterangan?: string | null }>
}

interface VersionHistoryRow {
  detailSopId: string
  versi: number
  status: string
  revisiDariDetailSopId: string | null
  canBuatVersiBaru: boolean
}

interface HistoricalFixture {
  original: ApprovedSopFixture
  v2DetailSopId: string
  v2Institution: string
}

test.describe('E2E pembuatan versi SOP dari riwayat', () => {
  test.describe.configure({ timeout: 120_000 })

  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  test('success: V1 DIGANTIKAN dapat dipilih melalui UI menjadi V3 tanpa mengubah V1/V2', async ({
    page,
  }) => {
    const fixture = await createHistoricalFixture('VERSION-HISTORY')
    let verificationContext: APIRequestContext | null = null
    try {
      await loginViaUi(page, users.penyusun)
      await page.goto(`/penyusun/sop/${fixture.original.detailSopId}`)
      await expectMainContent(page)

      await openVersionPanel(page)
      const v1Row = page.getByTestId('sop-version-row-1')
      const v2Row = page.getByTestId('sop-version-row-2')
      await expect(v1Row).toContainText(/digantikan/i)
      await expect(v2Row).toContainText(/berlaku/i)

      await v1Row.getByRole('button', { name: /buat versi baru dari versi 1/i }).click()
      const dialog = page.getByRole('dialog', { name: /buat versi baru/i })
      await expect(dialog).toContainText(/isi versi 1.*digantikan.*versi 3/i)
      await expect(dialog).toContainText(/riwayat semua versi lama tidak berubah/i)
      await dialog.getByRole('button', { name: /^buat versi baru$/i }).click()

      await expect.poll(() => currentDetailId(page.url())).not.toBe(fixture.original.detailSopId)
      const v3DetailSopId = currentDetailId(page.url())
      expect(v3DetailSopId).not.toBe(fixture.v2DetailSopId)
      await expect(page.locator('body')).toContainText('Biro Organisasi Sumbar')

      await openVersionPanel(page)
      await expect(page.getByTestId('sop-version-row-1')).toContainText(/digantikan/i)
      await expect(page.getByTestId('sop-version-row-2')).toContainText(/berlaku/i)
      await expect(page.getByTestId('sop-version-row-3')).toContainText(/draft/i)
      await expect(page.getByTestId('sop-version-row-3')).toContainText(/revisi dari v1/i)

      await page.getByTitle('Aktivitas').click()
      await expect(page.locator('body')).toContainText('Versi 3 dibuat berdasarkan versi 1')

      verificationContext = await createAuthenticatedApiContext(users.penyusun)
      const [v1, v2, v3] = await Promise.all([
        getWorkbench(verificationContext, fixture.original.detailSopId),
        getWorkbench(verificationContext, fixture.v2DetailSopId),
        getWorkbench(verificationContext, v3DetailSopId),
      ])
      expect(v1.detail.status).toBe('DIGANTIKAN')
      expect(v2.detail.status).toBe('BERLAKU')
      expect(v2.detail.namaLembaga).toBe(fixture.v2Institution)
      expect(v3.detail).toMatchObject({
        status: 'DRAFT',
        versi: 3,
        namaLembaga: 'Biro Organisasi Sumbar',
        revisiDariDetailSopId: fixture.original.detailSopId,
        revisiDariVersi: 1,
      })
    } finally {
      await verificationContext?.dispose()
    }
  })

  test('edge: versi DICABUT tetap dapat dijadikan sumber DRAFT baru melalui UI', async ({ page }) => {
    const approved = await createApprovedSopFixture('VERSION-REVOKED')
    const kepalaOpd = await createAuthenticatedApiContext(users.kepalaOpd)
    let verificationContext: APIRequestContext | null = null
    try {
      await apiPost(kepalaOpd, `/sop/cabut/${approved.detailSopId}`)

      await loginViaUi(page, users.penyusun)
      await page.goto(`/penyusun/sop/${approved.detailSopId}`)
      await expectMainContent(page)
      await openVersionPanel(page)

      const v1Row = page.getByTestId('sop-version-row-1')
      await expect(v1Row).toContainText(/dicabut/i)
      await v1Row.getByRole('button', { name: /buat versi baru dari versi 1/i }).click()
      const dialog = page.getByRole('dialog', { name: /buat versi baru/i })
      await expect(dialog).toContainText(/isi versi 1.*dicabut.*versi 2/i)
      await dialog.getByRole('button', { name: /^buat versi baru$/i }).click()

      await expect.poll(() => currentDetailId(page.url())).not.toBe(approved.detailSopId)
      const v2DetailSopId = currentDetailId(page.url())
      verificationContext = await createAuthenticatedApiContext(users.penyusun)
      const [v1, v2] = await Promise.all([
        getWorkbench(verificationContext, approved.detailSopId),
        getWorkbench(verificationContext, v2DetailSopId),
      ])
      expect(v1.detail.status).toBe('DICABUT')
      expect(v2.detail).toMatchObject({
        status: 'DRAFT',
        versi: 2,
        revisiDariDetailSopId: approved.detailSopId,
      })
    } finally {
      await Promise.all([kepalaOpd.dispose(), verificationContext?.dispose()])
    }
  })

  test('failure: revisi aktif memblokir sumber terminal dan sumber DRAFT ditolak', async ({ page }) => {
    const approved = await createApprovedSopFixture('VERSION-IN-FLIGHT')
    const setupContext = await createAuthenticatedApiContext(users.penyusun)
    let verificationContext: APIRequestContext | null = null
    try {
      const draft = await apiPost<VersionWorkbench>(
        setupContext,
        `/sop/${approved.detailSopId}/buat-versi-baru`,
      )

      await loginViaUi(page, users.penyusun)
      await page.goto(`/penyusun/sop/${approved.detailSopId}`)
      await expectMainContent(page)
      await openVersionPanel(page)

      const v1Action = page
        .getByTestId('sop-version-row-1')
        .getByRole('button', { name: /buat versi baru dari versi 1/i })
      await expect(v1Action).toBeDisabled()
      await expect(
        page
          .getByTestId('sop-version-row-2')
          .getByRole('button', { name: /buat versi baru dari versi 2/i }),
      ).toHaveCount(0)

      verificationContext = await createAuthenticatedApiContext(users.penyusun)
      const [fromActive, fromDraft] = await Promise.all([
        verificationContext.post(toApiUrl(`/sop/${approved.detailSopId}/buat-versi-baru`)),
        verificationContext.post(toApiUrl(`/sop/${draft.detail.id}/buat-versi-baru`)),
      ])
      expect(fromActive.status()).toBe(409)
      expect(fromDraft.status()).toBe(409)

      const history = await getHistory(verificationContext, approved.sopId)
      expect(history).toHaveLength(2)
      expect(history.filter((row) => row.status === 'DRAFT')).toHaveLength(1)
    } finally {
      await Promise.all([setupContext.dispose(), verificationContext?.dispose()])
    }
  })

  test('failure RBAC: role evaluator dan kepala OPD tidak dapat membuat versi baru', async () => {
    const approved = await createApprovedSopFixture('VERSION-RBAC')
    const evaluator = await createAuthenticatedApiContext(users.evaluator)
    const pjEvaluator = await createAuthenticatedApiContext(users.pjEvaluator)
    const kepalaOpd = await createAuthenticatedApiContext(users.kepalaOpd)
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    try {
      const responses = await Promise.all(
        [evaluator, pjEvaluator, kepalaOpd].map((context) =>
          context.post(toApiUrl(`/sop/${approved.detailSopId}/buat-versi-baru`)),
        ),
      )
      expect(responses.map((response) => response.status())).toEqual([403, 403, 403])

      const history = await getHistory(penyusun, approved.sopId)
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({
        detailSopId: approved.detailSopId,
        versi: 1,
        status: 'BERLAKU',
      })
    } finally {
      await Promise.all([
        evaluator.dispose(),
        pjEvaluator.dispose(),
        kepalaOpd.dispose(),
        penyusun.dispose(),
      ])
    }
  })

  test('worst case: dua request serentak hanya boleh menghasilkan satu versi DRAFT', async () => {
    const approved = await createApprovedSopFixture('VERSION-RACE')
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
    try {
      const endpoint = toApiUrl(`/sop/${approved.detailSopId}/buat-versi-baru`)
      const responses = await Promise.all([penyusun.post(endpoint), pjPenyusun.post(endpoint)])
      expect(responses.map((response) => response.status()).sort()).toEqual([201, 409])

      const history = await getHistory(penyusun, approved.sopId)
      expect(history).toHaveLength(2)
      expect(history.filter((row) => row.versi === 2 && row.status === 'DRAFT')).toHaveLength(1)
      expect(history.find((row) => row.versi === 2)?.revisiDariDetailSopId).toBe(
        approved.detailSopId,
      )
    } finally {
      await Promise.all([penyusun.dispose(), pjPenyusun.dispose()])
    }
  })
})

async function createHistoricalFixture(prefix: string): Promise<HistoricalFixture> {
  const original = await createApprovedSopFixture(prefix)
  const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
  try {
    const v2 = await apiPost<VersionWorkbench>(
      pjPenyusun,
      `/sop/${original.detailSopId}/buat-versi-baru`,
    )
    const v2Institution = `Konten khusus versi dua ${original.number}`
    await apiPatch(pjPenyusun, `/sop/header/${v2.detail.id}`, {
      namaLembaga: v2Institution,
    })
    await apiPatch(pjPenyusun, `/sop/status/${v2.detail.id}`, {
      status: 'MENUNGGU_PENGAJUAN_EVALUASI',
    })
    await promoteToBerlaku({
      ...original,
      detailSopId: v2.detail.id,
      number: v2.detail.nomorSOP,
      baNumber: `${original.baNumber}-V2`,
    })
    return { original, v2DetailSopId: v2.detail.id, v2Institution }
  } finally {
    await pjPenyusun.dispose()
  }
}

async function promoteToBerlaku(sop: ReadySopFixture): Promise<void> {
  const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
  const evaluator = await createAuthenticatedApiContext(users.evaluator)
  const pjEvaluator = await createAuthenticatedApiContext(users.pjEvaluator)
  const kepalaOpd = await createAuthenticatedApiContext(users.kepalaOpd)
  try {
    const pengajuanId = await createPengajuanForSop(pjPenyusun, sop.detailSopId)
    await nilaiSopSesuai(evaluator, pengajuanId, sop.detailSopId)
    await finishEvaluation(evaluator, pengajuanId, sop.baNumber)
    await ensureTteReady(pjEvaluator)
    await ensureTteReady(pjPenyusun)
    await ensureTteReady(kepalaOpd)
    await signBeritaAcara(pjEvaluator, pengajuanId, sop.baNumber, `Berita Acara ${sop.title}`)
    await signBeritaAcara(pjPenyusun, pengajuanId, sop.baNumber, `Berita Acara ${sop.title}`)
    await signAllSop(kepalaOpd, pengajuanId, sop.detailSopId, sop.number, sop.title)
  } finally {
    await Promise.all([
      pjPenyusun.dispose(),
      evaluator.dispose(),
      pjEvaluator.dispose(),
      kepalaOpd.dispose(),
    ])
  }
}

async function openVersionPanel(page: Page): Promise<void> {
  await page.locator('button[title="Versi"]').click()
  await expect(page.getByText('Riwayat versi dokumen')).toBeVisible()
}

async function getWorkbench(
  context: APIRequestContext,
  detailSopId: string,
): Promise<VersionWorkbench> {
  return apiGet<VersionWorkbench>(context, `/sop/penyusun-workbench/${detailSopId}`)
}

async function getHistory(
  context: APIRequestContext,
  sopId: string,
): Promise<VersionHistoryRow[]> {
  return apiGet<VersionHistoryRow[]>(context, `/sop/${sopId}/riwayat-versi`)
}

function currentDetailId(url: string): string {
  const id = new URL(url).pathname.split('/').filter(Boolean).at(-1)
  if (!id) throw new Error(`URL detail SOP tidak memuat ID: ${url}`)
  return id
}
