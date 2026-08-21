import { expect, test, type Page } from '@playwright/test'

async function waitForAppHydration(page: Page): Promise<void> {
  await page.locator('html[data-app-hydrated="true"]').waitFor({ state: 'attached', timeout: 20_000 })
}

function visibleProcedureField(page: Page, label: string) {
  return page.locator(`[aria-label="${label}"]:visible`)
}

async function openEditorSection(page: Page, section: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(section) }).click()
}

async function openAiReviewAndRun(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Review & Complete' }).click()
  const reviewButton = page.getByRole('button', { name: 'Periksa dengan AI' })
  await expect(reviewButton).toBeEnabled({ timeout: 20_000 })
  await reviewButton.click()
  await expect(page.getByText('Perjelas uraian langkah', { exact: true })).toBeVisible({ timeout: 20_000 })
}

async function completeCurrentVersion(page: Page, version: number): Promise<void> {
  await page.getByRole('button', { name: 'Review & Complete' }).click()
  const completeButton = page.getByRole('button', { name: `Complete versi ${version}` }).first()
  await expect(completeButton).toBeEnabled({ timeout: 20_000 })
  await completeButton.click()
  await page.getByRole('dialog').getByRole('button', { name: `Complete versi ${version}` }).click()
}

test('AI-assisted revision previews, applies through autosave, cancels without write, and preserves lifecycle', async ({ page }, testInfo) => {
  const workspaceName = `E2E AI Revision Workspace ${testInfo.retry}`
  const actorName = 'Petugas Revisi'
  const title = `SOP AI Revision E2E ${testInfo.retry}`
  const before = 'Proses awal'
  const after = 'Proses awal yang diperjelas'

  await page.goto('/workspaces')
  await waitForAppHydration(page)
  await page.getByPlaceholder('Nama workspace, mis. Project SOP Internal').fill(workspaceName)
  await page.getByRole('button', { name: 'Buat Workspace' }).click()
  await page.getByRole('link').filter({ hasText: workspaceName }).click()
  await waitForAppHydration(page)

  await page.getByRole('button', { name: 'Buat SOP' }).click()
  await page.getByRole('button', { name: 'Mulai kosong' }).click()
  await page.getByLabel('Judul SOP').fill(title)
  await page.getByLabel('Nomor SOP').fill(`E2E-REVISION-001-${testInfo.retry}`)
  await page.getByRole('button', { name: 'Buat dan lanjutkan' }).click()
  await waitForAppHydration(page)

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

  for (let index = 0; index < 3; index += 1) {
    await activities.nth(index).fill(index === 0 ? before : `Proses ${index + 1}`)
    await completeness.nth(index).fill('Dokumen input')
    await timeAmounts.nth(index).fill('1')
    await outputs.nth(index).fill('Dokumen output')
    await notes.nth(index).fill('Sesuai prosedur')
  }
  await expect(page.getByRole('status').filter({ hasText: 'Tersimpan' })).toBeVisible({ timeout: 20_000 })

  await openAiReviewAndRun(page)
  const findingTitle = 'Perjelas uraian langkah'
  const suggestButton = page.getByRole('button', { name: `Sarankan perbaikan ${findingTitle}` })
  await expect(suggestButton).toBeEnabled({ timeout: 20_000 })
  await suggestButton.click()

  await expect(page.getByLabel('Preview usulan AI')).toContainText('Langkah 1 · Kegiatan')
  await expect(page.getByLabel('Preview usulan AI')).toContainText(before)
  await expect(page.getByLabel('Preview usulan AI')).toContainText(after)

  await page.getByRole('button', { name: 'Terapkan' }).click()
  await expect(visibleProcedureField(page, 'Kegiatan').nth(0)).toHaveValue(after)
  await expect(page.getByRole('status').filter({ hasText: 'Tersimpan' })).toBeVisible({ timeout: 20_000 })

  const editorUrl = page.url()
  const persistedPage = await page.context().newPage()
  await persistedPage.goto(editorUrl)
  await waitForAppHydration(persistedPage)
  await openEditorSection(persistedPage, '3. Prosedur')
  await expect(visibleProcedureField(persistedPage, 'Kegiatan').nth(0)).toHaveValue(after)

  await openAiReviewAndRun(persistedPage)
  const secondSuggest = persistedPage.getByRole('button', { name: `Sarankan perbaikan ${findingTitle}` })
  await expect(secondSuggest).toBeEnabled()
  await secondSuggest.click()
  await expect(persistedPage.getByLabel('Preview usulan AI')).toBeVisible()
  await persistedPage.getByRole('button', { name: 'Batal' }).click()
  await expect(persistedPage.getByLabel('Preview usulan AI')).toHaveCount(0)

  const cancelCheckPage = await page.context().newPage()
  await cancelCheckPage.goto(editorUrl)
  await waitForAppHydration(cancelCheckPage)
  await openEditorSection(cancelCheckPage, '3. Prosedur')
  await expect(visibleProcedureField(cancelCheckPage, 'Kegiatan').nth(0)).toHaveValue(after)

  await cancelCheckPage.getByRole('button', { name: 'Preview' }).click()
  await cancelCheckPage.getByRole('tab', { name: 'BPMN' }).click()
  await expect(cancelCheckPage.locator('.sop-print-diagram-bpmn')).toBeVisible({ timeout: 20_000 })
  await cancelCheckPage.getByRole('tab', { name: 'Flowchart' }).click()
  await expect(cancelCheckPage.locator('.sop-print-diagram-flowchart')).toBeVisible({ timeout: 20_000 })

  await completeCurrentVersion(cancelCheckPage, 1)
  await expect(cancelCheckPage.getByRole('button', { name: 'Buat versi baru' }).first()).toBeVisible({ timeout: 20_000 })
  await expect(cancelCheckPage.getByRole('button', { name: 'Periksa dengan AI' })).toHaveCount(0)

  const completedUrl = cancelCheckPage.url()
  await cancelCheckPage.getByRole('button', { name: 'Buat versi baru' }).first().click()
  await expect.poll(() => cancelCheckPage.url(), { timeout: 20_000 }).not.toBe(completedUrl)
  await waitForAppHydration(cancelCheckPage)
  await expect(cancelCheckPage.getByText('v2', { exact: true })).toBeVisible()
  await expect(cancelCheckPage.getByRole('button', { name: 'Review & Complete' })).toBeVisible()

  await page.close()
  await persistedPage.close()
})
