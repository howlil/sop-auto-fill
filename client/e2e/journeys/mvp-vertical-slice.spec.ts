import { test, expect, type Page } from '@playwright/test'

async function waitForAppHydration(page: Page): Promise<void> {
  await page.locator('html[data-app-hydrated="true"]').waitFor({
    state: 'attached',
    timeout: 20_000,
  })
}

function visibleProcedureField(page: Page, label: string) {
  return page.locator(`[aria-label="${label}"]:visible`)
}

async function installPdfPrintHarness(page: Page): Promise<void> {
  await page.evaluate(() => {
    type PdfEvidenceWindow = Window & {
      __e2ePdfBlob?: { type: string; size: number }
    }

    const testWindow = window as PdfEvidenceWindow
    const originalCreateObjectURL = URL.createObjectURL.bind(URL)
    const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL)
    const pdfSentinelUrl = 'about:blank#e2e-pdf'

    testWindow.__e2ePdfBlob = undefined

    URL.createObjectURL = ((object: Blob | MediaSource) => {
      if (object instanceof Blob && object.type === 'application/pdf') {
        testWindow.__e2ePdfBlob = { type: object.type, size: object.size }
        return pdfSentinelUrl
      }
      return originalCreateObjectURL(object)
    }) as typeof URL.createObjectURL

    URL.revokeObjectURL = ((url: string) => {
      if (url === pdfSentinelUrl) return
      originalRevokeObjectURL(url)
    }) as typeof URL.revokeObjectURL
  })
}

async function expectPdfBlobGenerated(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const evidence = (
            window as Window & { __e2ePdfBlob?: { type: string; size: number } }
          ).__e2ePdfBlob
          return evidence?.type ?? null
        }),
      { timeout: 30_000 },
    )
    .toBe('application/pdf')

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const evidence = (
            window as Window & { __e2ePdfBlob?: { type: string; size: number } }
          ).__e2ePdfBlob
          return evidence?.size ?? 0
        }),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0)
}

test('MVP workspace SOP survives reload and versions a completed SOP', async ({ page }, testInfo) => {
  const workspaceName = `E2E MVP Workspace ${testInfo.retry}`
  const actorName = 'E2E Admin'
  const initialTitle = 'SOP MVP E2E'
  const updatedTitle = 'SOP MVP E2E Autosaved'

  await page.goto('/workspaces')
  await waitForAppHydration(page)
  await expect(page.getByText('E2E User', { exact: true })).toBeVisible()

  await page
    .getByPlaceholder('Nama workspace, mis. Project SOP Internal')
    .fill(workspaceName)
  await page.getByRole('button', { name: 'Buat Workspace' }).click()
  await page.getByRole('link').filter({ hasText: workspaceName }).click()
  await waitForAppHydration(page)

  await page.getByPlaceholder('Nama pelaksana').fill(actorName)
  await page.getByRole('button', { name: 'Tambah Pelaksana' }).click()
  await expect(page.getByLabel('Daftar pelaksana workspace').getByText(actorName, { exact: true })).toBeVisible()

  await page.getByPlaceholder('Judul SOP').fill(initialTitle)
  await page.getByPlaceholder('Nomor SOP').fill(`E2E-001-${testInfo.retry}`)
  await page.getByRole('button', { name: 'Buat SOP' }).click()
  await waitForAppHydration(page)

  await expect(page.getByText('Dokumen SOP', { exact: true })).toBeVisible()
  const titleInput = page.getByPlaceholder('Judul SOP')
  await titleInput.fill(updatedTitle)

  await page.getByRole('button', { name: 'Tambah aktor pelaksana' }).click()
  const actorCheckbox = page.getByRole('checkbox', { name: actorName })
  await page.getByText(actorName, { exact: true }).click()
  await expect(actorCheckbox).toBeChecked()
  await page.getByRole('button', { name: 'Tambahkan' }).click()
  await expect(page.getByText(actorName)).toBeVisible()

  await page.getByRole('button', { name: 'Langkah' }).click()
  const addStep = page.getByRole('button', { name: 'Tambah langkah' })
  await addStep.click()
  await addStep.click()
  await addStep.click()

  const activities = visibleProcedureField(page, 'Kegiatan')
  const completeness = visibleProcedureField(page, 'Kelengkapan')
  const timeAmounts = visibleProcedureField(page, 'Jumlah waktu')
  const outputs = visibleProcedureField(page, 'Output')
  const notes = visibleProcedureField(page, 'Keterangan')
  await expect(activities).toHaveCount(3)

  const activityValues = ['Mulai proses', 'Verifikasi dokumen', 'Selesai proses']
  for (let index = 0; index < 3; index += 1) {
    await activities.nth(index).fill(activityValues[index])
    await completeness.nth(index).fill('Dokumen input')
    await timeAmounts.nth(index).fill('1')
    await outputs.nth(index).fill('Dokumen output')
    await notes.nth(index).fill('Sesuai prosedur')
  }

  await expect(page.getByRole('status').filter({ hasText: 'Tersimpan' })).toBeVisible({
    timeout: 20_000,
  })

  await page.reload()
  await waitForAppHydration(page)
  await expect(page.getByPlaceholder('Judul SOP')).toHaveValue(updatedTitle)
  await page.getByRole('button', { name: 'Langkah' }).click()
  await expect(visibleProcedureField(page, 'Kegiatan').nth(1)).toHaveValue('Verifikasi dokumen')
  await expect(visibleProcedureField(page, 'Kelengkapan').nth(1)).toHaveValue('Dokumen input')
  await page.getByRole('button', { name: 'Selesai edit' }).click()

  await expect(page.getByRole('tab', { name: 'Flowchart' })).toBeVisible()
  await page.getByRole('tab', { name: 'BPMN' }).click()
  await expect(page.locator('.sop-print-diagram-bpmn')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('tab', { name: 'Flowchart' }).click()
  await expect(page.locator('.sop-print-diagram-flowchart')).toBeVisible({ timeout: 20_000 })

  // Prove the application builds a non-empty PDF Blob while neutralizing Chrome's native
  // PDF viewer/print lifecycle, which is outside application behavior and unstable in hosted CI.
  await installPdfPrintHarness(page)
  await page.getByRole('button', { name: 'Cetak PDF' }).click()
  await expectPdfBlobGenerated(page)
  await page.locator('iframe[src="about:blank#e2e-pdf"]').waitFor({
    state: 'attached',
    timeout: 10_000,
  })
  await expect(page.getByText('Gagal menyiapkan PDF. Coba muat ulang halaman.')).toHaveCount(0)

  // The native print completion event is a browser/OS concern. Continue the persisted SOP
  // lifecycle in a fresh page that shares the same authenticated browser context.
  const editorUrlAfterPdf = page.url()
  const continuationPage = await page.context().newPage()
  await continuationPage.goto(editorUrlAfterPdf)
  await waitForAppHydration(continuationPage)
  await expect(continuationPage.getByPlaceholder('Judul SOP')).toHaveValue(updatedTitle)
  await page.close()

  await continuationPage.getByRole('button', { name: 'Selesai' }).click()
  await continuationPage.getByRole('button', { name: 'Ya, selesai' }).click()
  await expect(continuationPage.getByRole('button', { name: 'Buat versi baru' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(continuationPage.getByPlaceholder('Judul SOP')).toHaveCount(0)

  const completedUrl = continuationPage.url()
  await continuationPage.getByRole('button', { name: 'Buat versi baru' }).click()
  await expect.poll(() => continuationPage.url(), { timeout: 20_000 }).not.toBe(completedUrl)
  await waitForAppHydration(continuationPage)
  await expect(continuationPage.getByPlaceholder('Judul SOP')).toHaveValue(updatedTitle)
  await continuationPage.getByRole('button', { name: 'Langkah' }).click()
  await expect(visibleProcedureField(continuationPage, 'Kegiatan').nth(1)).toHaveValue('Verifikasi dokumen')
  await expect(visibleProcedureField(continuationPage, 'Kelengkapan').nth(1)).toHaveValue('Dokumen input')
  await continuationPage.getByRole('button', { name: 'Selesai edit' }).click()
  await expect(continuationPage.getByText('v2', { exact: true })).toBeVisible()
  await expect(continuationPage.getByRole('button', { name: 'Selesai' })).toBeVisible()
})

test('system template creates a normal draft and preserves the existing lifecycle', async ({ page }, testInfo) => {
  const workspaceName = `E2E Template Workspace ${testInfo.retry}`
  const reusedActor = 'Petugas Layanan'
  const title = `SOP Pelayanan Template E2E ${testInfo.retry}`
  const updatedActivity = 'Memproses permohonan layanan terverifikasi'

  await page.goto('/workspaces')
  await waitForAppHydration(page)

  await page
    .getByPlaceholder('Nama workspace, mis. Project SOP Internal')
    .fill(workspaceName)
  await page.getByRole('button', { name: 'Buat Workspace' }).click()
  await page.getByRole('link').filter({ hasText: workspaceName }).click()
  await waitForAppHydration(page)

  await page.getByPlaceholder('Nama pelaksana').fill(reusedActor)
  await page.getByRole('button', { name: 'Tambah Pelaksana' }).click()
  await expect(page.getByLabel('Daftar pelaksana workspace').getByText(reusedActor, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Dari Template' }).click()
  const templateSelect = page.getByLabel('Template sistem')
  await expect(templateSelect.getByRole('option', { name: 'Pelayanan' })).toHaveCount(1)
  await templateSelect.selectOption({ label: 'Pelayanan' })

  const reusedActorsPreview = page.getByText('Aktor dipakai ulang', { exact: true }).locator('..')
  const newActorsPreview = page.getByText('Aktor baru', { exact: true }).locator('..')
  await expect(reusedActorsPreview).toContainText(reusedActor)
  await expect(newActorsPreview).toContainText('Pelaksana Layanan')
  await expect(newActorsPreview).toContainText('Penanggung Jawab Layanan')
  await expect(page.getByText('5 langkah', { exact: true })).toBeVisible()

  await page.getByPlaceholder('Judul SOP').fill(title)
  await page.getByPlaceholder('Nomor SOP').fill(`E2E-TPL-001-${testInfo.retry}`)
  await page.getByPlaceholder('Nama lembaga').fill('Unit Pelayanan E2E')
  await page.getByRole('button', { name: 'Buat dari Template' }).click()
  await waitForAppHydration(page)

  await expect(page.getByText('Dokumen SOP', { exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('Judul SOP')).toHaveValue(title)
  await expect(page.getByPlaceholder('Peringatan 1')).toHaveValue(
    'Jangan memproses permohonan yang persyaratannya belum lengkap.',
  )

  await page.getByRole('button', { name: 'Langkah' }).click()
  const activities = visibleProcedureField(page, 'Kegiatan')
  await expect(activities).toHaveCount(5)
  await expect(activities.nth(1)).toHaveValue('Memeriksa kelengkapan persyaratan')
  await activities.nth(2).fill(updatedActivity)
  await expect(page.getByRole('status').filter({ hasText: 'Tersimpan' })).toBeVisible({
    timeout: 20_000,
  })

  await page.reload()
  await waitForAppHydration(page)
  await page.getByRole('button', { name: 'Langkah' }).click()
  await expect(visibleProcedureField(page, 'Kegiatan').nth(2)).toHaveValue(updatedActivity)
  await page.getByRole('button', { name: 'Selesai edit' }).click()

  await page.getByRole('tab', { name: 'BPMN' }).click()
  await expect(page.locator('.sop-print-diagram-bpmn')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('tab', { name: 'Flowchart' }).click()
  await expect(page.locator('.sop-print-diagram-flowchart')).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: 'Selesai' }).click()
  await page.getByRole('button', { name: 'Ya, selesai' }).click()
  await expect(page.getByRole('button', { name: 'Buat versi baru' })).toBeVisible({ timeout: 20_000 })

  const completedUrl = page.url()
  await page.getByRole('button', { name: 'Buat versi baru' }).click()
  await expect.poll(() => page.url(), { timeout: 20_000 }).not.toBe(completedUrl)
  await waitForAppHydration(page)
  await expect(page.getByPlaceholder('Judul SOP')).toHaveValue(title)
  await page.getByRole('button', { name: 'Langkah' }).click()
  await expect(visibleProcedureField(page, 'Kegiatan').nth(2)).toHaveValue(updatedActivity)
  await page.getByRole('button', { name: 'Selesai edit' }).click()
  await expect(page.getByText('v2', { exact: true })).toBeVisible()
})
