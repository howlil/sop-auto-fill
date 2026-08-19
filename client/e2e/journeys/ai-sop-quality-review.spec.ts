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

test('AI quality review uses saved draft state, stays advisory, clears after edits, and preserves lifecycle', async ({ page }, testInfo) => {
  const workspaceName = `E2E AI Review Workspace ${testInfo.retry}`
  const title = `SOP AI Review E2E ${testInfo.retry}`
  const beforeReviewActivity = 'Memverifikasi kelengkapan dengan bukti pendukung'
  const afterReviewActivity = 'Memverifikasi kelengkapan dan mencatat hasil pemeriksaan'

  await page.goto('/workspaces')
  await waitForAppHydration(page)
  await expect(page.getByText('E2E User', { exact: true })).toBeVisible()

  await page
    .getByPlaceholder('Nama workspace, mis. Project SOP Internal')
    .fill(workspaceName)
  await page.getByRole('button', { name: 'Buat Workspace' }).click()
  await page.getByRole('link').filter({ hasText: workspaceName }).click()
  await waitForAppHydration(page)

  await page.getByRole('button', { name: 'Dengan AI' }).click()
  await page.getByLabel('Deskripsi proses').fill(
    'Petugas menerima permohonan, verifikator memeriksa kelengkapan, dokumen yang tidak lengkap dikembalikan, dan hasil diserahkan setelah lengkap.',
  )
  const generateButton = page.getByRole('button', { name: 'Generate Draft' })
  await expect(generateButton).toBeEnabled({ timeout: 20_000 })
  await generateButton.click()
  await expect(
    page.getByText('Konten ini dihasilkan AI dan harus ditinjau sebelum digunakan.'),
  ).toBeVisible({ timeout: 20_000 })

  await page.getByPlaceholder('Judul SOP').fill(title)
  await page.getByPlaceholder('Nomor SOP').fill(`E2E-REVIEW-001-${testInfo.retry}`)
  await page.getByPlaceholder('Nama lembaga').fill('Unit AI Review E2E')
  await page.getByRole('button', { name: 'Buat Draft SOP' }).click()
  await waitForAppHydration(page)
  await expect(page.getByText('Dokumen SOP', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Langkah' }).click()
  const activities = visibleProcedureField(page, 'Kegiatan')
  await expect(activities).toHaveCount(3)
  await activities.nth(1).fill(beforeReviewActivity)

  await page.getByRole('tab', { name: 'AI Review' }).click()
  const reviewButton = page.getByRole('button', { name: 'Periksa dengan AI' })
  await expect(reviewButton).toBeEnabled({ timeout: 20_000 })
  await reviewButton.click()

  await expect(page.getByText('Cukup baik', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Periksa kembali routing keputusan', { exact: true })).toBeVisible()
  const findingButton = page.getByRole('button', { name: 'Buka Periksa kembali routing keputusan' })
  await expect(findingButton).toContainText('Langkah 2')
  await expect(page.getByText(/bukan persetujuan/i)).toBeVisible()

  await findingButton.click()
  await expect(page.locator('[data-sop-step-order="2"]:visible')).toBeVisible()
  await expect(visibleProcedureField(page, 'Kegiatan').nth(1)).toHaveValue(beforeReviewActivity)

  await visibleProcedureField(page, 'Kegiatan').nth(1).fill(afterReviewActivity)
  await expect(page.getByText('Periksa kembali routing keputusan', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Periksa dengan AI' })).toBeEnabled()

  await page.getByRole('button', { name: 'Periksa dengan AI' }).click()
  await expect(page.getByText('Periksa kembali routing keputusan', { exact: true })).toBeVisible({
    timeout: 20_000,
  })
  await expect(visibleProcedureField(page, 'Kegiatan').nth(1)).toHaveValue(afterReviewActivity)

  await page.getByRole('button', { name: 'Selesai edit' }).click()
  await page.getByRole('button', { name: 'Selesai' }).click()
  await page.getByRole('button', { name: 'Ya, selesai' }).click()
  await expect(page.getByRole('button', { name: 'Buat versi baru' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('tab', { name: 'AI Review' })).toHaveCount(0)

  const completedUrl = page.url()
  await page.getByRole('button', { name: 'Buat versi baru' }).click()
  await expect.poll(() => page.url(), { timeout: 20_000 }).not.toBe(completedUrl)
  await waitForAppHydration(page)
  await expect(page.getByText('v2', { exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'AI Review' })).toBeVisible()
  await page.getByRole('button', { name: 'Langkah' }).click()
  await expect(visibleProcedureField(page, 'Kegiatan').nth(1)).toHaveValue(afterReviewActivity)
})
