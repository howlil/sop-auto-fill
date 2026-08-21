import { expect, test, type Page } from '@playwright/test'

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

test('AI draft preview confirms into a normal SOP and preserves the existing lifecycle', async ({ page }, testInfo) => {
  const workspaceName = `E2E AI Workspace ${testInfo.retry}`
  const title = `SOP AI E2E ${testInfo.retry}`
  const updatedActivity = 'Memverifikasi permohonan layanan dengan bukti lengkap'

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
  await page.getByRole('button', { name: 'Buat dengan AI' }).click()
  await page.getByLabel('Apa proses yang ingin Anda dokumentasikan?').fill(
    'Petugas menerima permohonan layanan, verifikator memeriksa kelengkapan, permohonan tidak lengkap dikembalikan, dan hasil layanan diserahkan setelah lengkap.',
  )

  const generateButton = page.getByRole('button', { name: /Generate draft/i })
  await expect(generateButton).toBeEnabled({ timeout: 20_000 })
  await generateButton.click()

  await expect(page.getByText('Preview AI', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/3 langkah/)).toBeVisible()
  await expect(page.getByLabel('Judul SOP')).toHaveValue('SOP Pelayanan Permohonan')

  await page.getByLabel('Judul SOP').fill(title)
  await page.getByLabel('Nomor SOP').fill(`E2E-AI-001-${testInfo.retry}`)
  await page.getByLabel('Nama lembaga').fill('Unit Pelayanan AI E2E')
  await page.getByRole('button', { name: 'Buat dan lanjutkan' }).click()
  await waitForAppHydration(page)

  await expect(page.getByRole('heading', { name: 'Informasi Dasar' })).toBeVisible()
  await expect(page.getByLabel('Judul SOP')).toHaveValue(title)

  await openEditorSection(page, '2. Pelaksana')
  await expect(page.getByText('Petugas Layanan', { exact: true })).toBeVisible()
  await expect(page.getByText('Verifikator', { exact: true })).toBeVisible()

  await openEditorSection(page, '3. Prosedur')
  const activities = visibleProcedureField(page, 'Kegiatan')
  await expect(activities).toHaveCount(3)
  await expect(activities.nth(1)).toHaveValue('Memverifikasi kelengkapan')
  await activities.nth(1).fill(updatedActivity)
  await expect(page.getByRole('status').filter({ hasText: 'Tersimpan' })).toBeVisible({
    timeout: 20_000,
  })

  await page.reload()
  await waitForAppHydration(page)
  await openEditorSection(page, '3. Prosedur')
  await expect(visibleProcedureField(page, 'Kegiatan').nth(1)).toHaveValue(updatedActivity)

  await openPreview(page)
  await page.getByRole('tab', { name: 'BPMN' }).click()
  await expect(page.locator('.sop-print-diagram-bpmn')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('tab', { name: 'Flowchart' }).click()
  await expect(page.locator('.sop-print-diagram-flowchart')).toBeVisible({ timeout: 20_000 })

  await completeCurrentVersion(page, 1)
  await expect(page.getByRole('button', { name: 'Buat versi baru' }).first()).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByText('Versi ini sudah selesai dan dikunci')).toBeVisible()

  const completedUrl = page.url()
  await page.getByRole('button', { name: 'Buat versi baru' }).first().click()
  await expect.poll(() => page.url(), { timeout: 20_000 }).not.toBe(completedUrl)
  await waitForAppHydration(page)
  await expect(page.getByLabel('Judul SOP')).toHaveValue(title)
  await openEditorSection(page, '3. Prosedur')
  await expect(visibleProcedureField(page, 'Kegiatan').nth(1)).toHaveValue(updatedActivity)
  await expect(page.getByText('v2', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review & Complete' })).toBeVisible()
})
