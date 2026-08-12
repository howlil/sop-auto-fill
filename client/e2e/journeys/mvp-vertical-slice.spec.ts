import { test, expect, type Page } from '@playwright/test'

async function waitForAppHydration(page: Page): Promise<void> {
  await page.locator('html[data-app-hydrated="true"]').waitFor({
    state: 'attached',
    timeout: 20_000,
  })
}

test('MVP workspace SOP survives reload and versions a completed SOP', async ({ page }) => {
  const workspaceName = 'E2E MVP Workspace'
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
  await page.getByPlaceholder('Nomor SOP').fill('E2E-001')
  await page.getByRole('button', { name: 'Buat SOP' }).click()
  await waitForAppHydration(page)

  await expect(page.getByText('Dokumen SOP', { exact: true })).toBeVisible()
  const titleInput = page.getByPlaceholder('Judul SOP')
  await titleInput.fill(updatedTitle)

  await page.getByRole('button', { name: 'Tambah aktor pelaksana' }).click()
  await page.getByRole('checkbox', { name: actorName }).check()
  await page.getByRole('button', { name: 'Tambahkan' }).click()
  await expect(page.getByText(actorName, { exact: true })).toBeVisible()

  const addStep = page.getByRole('button', { name: 'Tambah langkah' })
  await addStep.click()
  await addStep.click()
  await addStep.click()
  const activities = page.getByLabel('Kegiatan')
  await expect(activities).toHaveCount(3)
  await activities.nth(0).fill('Mulai proses')
  await activities.nth(1).fill('Verifikasi dokumen')
  await activities.nth(2).fill('Selesai proses')

  await expect(page.getByRole('status').filter({ hasText: 'Tersimpan' })).toBeVisible({
    timeout: 20_000,
  })

  await page.reload()
  await waitForAppHydration(page)
  await expect(page.getByPlaceholder('Judul SOP')).toHaveValue(updatedTitle)
  await expect(page.getByLabel('Kegiatan').nth(1)).toHaveValue('Verifikasi dokumen')

  await expect(page.getByRole('tab', { name: 'Flowchart' })).toBeVisible()
  await page.getByRole('tab', { name: 'BPMN' }).click()
  await expect(page.locator('.sop-print-diagram-bpmn')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('tab', { name: 'Flowchart' }).click()
  await expect(page.locator('.sop-print-diagram-flowchart')).toBeVisible({ timeout: 20_000 })

  const pdfButton = page.getByRole('button', { name: 'Cetak PDF' })
  await pdfButton.click()
  await expect(pdfButton).toContainText('Menyiapkan', { timeout: 20_000 })
  await page.locator('iframe[src^="blob:"]').waitFor({ state: 'attached', timeout: 30_000 })
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(pdfButton).toHaveText(/Cetak PDF/, { timeout: 10_000 })
  await expect(page.getByText('Gagal menyiapkan PDF. Coba muat ulang halaman.')).toHaveCount(0)

  await page.getByRole('button', { name: 'Selesai' }).click()
  await page.getByRole('button', { name: 'Ya, selesai' }).click()
  await expect(page.getByRole('button', { name: 'Buat versi baru' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByPlaceholder('Judul SOP')).toHaveCount(0)

  const completedUrl = page.url()
  await page.getByRole('button', { name: 'Buat versi baru' }).click()
  await expect.poll(() => page.url(), { timeout: 20_000 }).not.toBe(completedUrl)
  await waitForAppHydration(page)
  await expect(page.getByPlaceholder('Judul SOP')).toHaveValue(updatedTitle)
  await expect(page.getByLabel('Kegiatan').nth(1)).toHaveValue('Verifikasi dokumen')
  await expect(page.getByText('v2', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Selesai' })).toBeVisible()
})
