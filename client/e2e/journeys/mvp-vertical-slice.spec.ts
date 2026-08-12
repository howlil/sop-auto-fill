import { test, expect } from '@playwright/test'

test('MVP workspace SOP survives reload and versions a completed SOP', async ({ page }) => {
  const workspaceName = 'E2E MVP Workspace'
  const initialTitle = 'SOP MVP E2E'
  const updatedTitle = 'SOP MVP E2E Autosaved'

  await page.goto('/workspaces')
  await expect(page.getByText('E2E User', { exact: true })).toBeVisible()

  await page
    .getByPlaceholder('Nama workspace, mis. Project SOP Internal')
    .fill(workspaceName)
  await page.getByRole('button', { name: 'Buat Workspace' }).click()
  await page.getByRole('link').filter({ hasText: workspaceName }).click()

  await page.getByPlaceholder('Judul SOP').fill(initialTitle)
  await page.getByPlaceholder('Nomor SOP').fill('E2E-001')
  await page.getByRole('button', { name: 'Buat SOP' }).click()

  await expect(page.getByText('Dokumen SOP', { exact: true })).toBeVisible()
  const titleInput = page.getByPlaceholder('Judul SOP')
  await titleInput.fill(updatedTitle)
  await expect(page.getByRole('status').filter({ hasText: 'Tersimpan' })).toBeVisible({
    timeout: 20_000,
  })

  await page.reload()
  await expect(page.getByPlaceholder('Judul SOP')).toHaveValue(updatedTitle)

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
  await expect(page.getByPlaceholder('Judul SOP')).toHaveValue(updatedTitle)
  await expect(page.getByText('v2', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Selesai' })).toBeVisible()
})
