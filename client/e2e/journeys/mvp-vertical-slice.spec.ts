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

async function openEditorSection(page: Page, section: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(section) }).click()
}

async function openPreview(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByText('Dokumen dan diagram', { exact: true })).toBeVisible()
}

async function completeCurrentVersion(page: Page, version: number): Promise<void> {
  await page.getByRole('button', { name: 'Review & Complete' }).click()
  const completeButton = page.getByRole('button', { name: `Complete versi ${version}` }).first()
  await expect(completeButton).toBeEnabled({ timeout: 20_000 })
  await completeButton.click()
  await page.getByRole('dialog').getByRole('button', { name: `Complete versi ${version}` }).click()
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

  await page.getByRole('button', { name: 'Buat SOP', exact: true }).click()
  await page.getByRole('button', { name: 'Mulai kosong' }).click()
  await page.getByLabel('Judul SOP').fill(initialTitle)
  await page.getByLabel('Nomor SOP').fill(`E2E-001-${testInfo.retry}`)
  await page.getByRole('button', { name: 'Buat dan lanjutkan' }).click()
  await waitForAppHydration(page)

  await expect(page.getByRole('heading', { name: 'Informasi Dasar' })).toBeVisible()
  const titleInput = page.getByLabel('Judul SOP')
  await titleInput.fill(updatedTitle)

  await openEditorSection(page, '2. Pelaksana')
  await page.getByPlaceholder('Contoh: Evaluator, Admin OPD, Kepala Bagian').fill(actorName)
  await page.getByRole('button', { name: 'Tambah', exact: true }).click()
  await expect(page.getByText(actorName, { exact: true })).toBeVisible()

  await openEditorSection(page, '3. Prosedur')
  const addStep = page.getByRole('button', { name: /Tambah langkah/ })
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
  await expect(page.getByLabel('Judul SOP')).toHaveValue(updatedTitle)
  await openEditorSection(page, '3. Prosedur')
  await expect(visibleProcedureField(page, 'Kegiatan').nth(1)).toHaveValue('Verifikasi dokumen')
  await expect(visibleProcedureField(page, 'Kelengkapan').nth(1)).toHaveValue('Dokumen input')

  await openPreview(page)
  await expect(page.getByRole('tab', { name: 'Flowchart' })).toBeVisible()
  await page.getByRole('tab', { name: 'BPMN' }).click()
  await expect(page.locator('.sop-print-diagram-bpmn')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('tab', { name: 'Flowchart' }).click()
  await expect(page.locator('.sop-print-diagram-flowchart')).toBeVisible({ timeout: 20_000 })

  await installPdfPrintHarness(page)
  await page.getByRole('button', { name: 'PDF' }).click()
  await expectPdfBlobGenerated(page)
  await page.locator('iframe[src="about:blank#e2e-pdf"]').waitFor({
    state: 'attached',
    timeout: 10_000,
  })
  await expect(page.getByText('Gagal menyiapkan PDF. Coba muat ulang halaman.')).toHaveCount(0)

  const editorUrlAfterPdf = page.url()
  const continuationPage = await page.context().newPage()
  await continuationPage.goto(editorUrlAfterPdf)
  await waitForAppHydration(continuationPage)
  await expect(continuationPage.getByLabel('Judul SOP')).toHaveValue(updatedTitle)
  await page.close()

  await completeCurrentVersion(continuationPage, 1)
  await expect(continuationPage.getByRole('button', { name: 'Buat versi baru' }).first()).toBeVisible({
    timeout: 20_000,
  })
  await expect(continuationPage.getByText('Versi ini sudah selesai dan dikunci')).toBeVisible()

  const completedUrl = continuationPage.url()
  await continuationPage.getByRole('button', { name: 'Buat versi baru' }).first().click()
  await expect.poll(() => continuationPage.url(), { timeout: 20_000 }).not.toBe(completedUrl)
  await waitForAppHydration(continuationPage)
  await expect(continuationPage.getByLabel('Judul SOP')).toHaveValue(updatedTitle)
  await openEditorSection(continuationPage, '3. Prosedur')
  await expect(visibleProcedureField(continuationPage, 'Kegiatan').nth(1)).toHaveValue('Verifikasi dokumen')
  await expect(visibleProcedureField(continuationPage, 'Kelengkapan').nth(1)).toHaveValue('Dokumen input')
  await expect(continuationPage.getByText('v2', { exact: true })).toBeVisible()
  await expect(continuationPage.getByRole('button', { name: 'Review & Complete' })).toBeVisible()
})

test('system template creates a normal draft and preserves the existing lifecycle', async ({ page }, testInfo) => {
  const workspaceName = `E2E Template Workspace ${testInfo.retry}`
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

  await page.getByRole('button', { name: 'Buat SOP', exact: true }).click()
  await page.getByRole('button', { name: 'Gunakan template' }).click()
  const templateSelect = page.getByLabel('Template sistem')
  await expect(templateSelect.getByRole('option', { name: 'Pelayanan' })).toHaveCount(1)
  await templateSelect.selectOption({ label: 'Pelayanan' })

  await expect(page.getByText(/5 langkah/)).toBeVisible()
  await expect(page.getByText(/pelaksana/)).toBeVisible()

  await page.getByLabel('Judul SOP').fill(title)
  await page.getByLabel('Nomor SOP').fill(`E2E-TPL-001-${testInfo.retry}`)
  await page.getByLabel('Nama lembaga').fill('Unit Pelayanan E2E')
  await page.getByRole('button', { name: 'Buat dan lanjutkan' }).click()
  await waitForAppHydration(page)

  await expect(page.getByRole('heading', { name: 'Informasi Dasar' })).toBeVisible()
  await expect(page.getByLabel('Judul SOP')).toHaveValue(title)

  await openEditorSection(page, '2. Pelaksana')
  await expect(page.getByText('Petugas Layanan', { exact: true })).toBeVisible()
  await expect(page.getByText('Pelaksana Layanan', { exact: true })).toBeVisible()
  await expect(page.getByText('Penanggung Jawab Layanan', { exact: true })).toBeVisible()

  await openEditorSection(page, '4. Informasi Pendukung')
  await expect(page.getByPlaceholder('Tuliskan peringatan').first()).toHaveValue(
    'Jangan memproses permohonan yang persyaratannya belum lengkap.',
  )

  await openEditorSection(page, '3. Prosedur')
  const activities = visibleProcedureField(page, 'Kegiatan')
  await expect(activities).toHaveCount(5)
  await expect(activities.nth(1)).toHaveValue('Memeriksa kelengkapan persyaratan')
  await activities.nth(2).fill(updatedActivity)
  await expect(page.getByRole('status').filter({ hasText: 'Tersimpan' })).toBeVisible({
    timeout: 20_000,
  })

  await page.reload()
  await waitForAppHydration(page)
  await openEditorSection(page, '3. Prosedur')
  await expect(visibleProcedureField(page, 'Kegiatan').nth(2)).toHaveValue(updatedActivity)

  await openPreview(page)
  await page.getByRole('tab', { name: 'BPMN' }).click()
  await expect(page.locator('.sop-print-diagram-bpmn')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('tab', { name: 'Flowchart' }).click()
  await expect(page.locator('.sop-print-diagram-flowchart')).toBeVisible({ timeout: 20_000 })

  await completeCurrentVersion(page, 1)
  await expect(page.getByRole('button', { name: 'Buat versi baru' }).first()).toBeVisible({ timeout: 20_000 })

  const completedUrl = page.url()
  await page.getByRole('button', { name: 'Buat versi baru' }).first().click()
  await expect.poll(() => page.url(), { timeout: 20_000 }).not.toBe(completedUrl)
  await waitForAppHydration(page)
  await expect(page.getByLabel('Judul SOP')).toHaveValue(title)
  await openEditorSection(page, '3. Prosedur')
  await expect(visibleProcedureField(page, 'Kegiatan').nth(2)).toHaveValue(updatedActivity)
  await expect(page.getByText('v2', { exact: true })).toBeVisible()
})
