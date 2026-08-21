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

async function openReview(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Review & Complete' }).click()
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
}

async function completeCurrentVersion(page: Page, version: number): Promise<void> {
  await openReview(page)
  const completeButton = page.getByRole('button', { name: `Complete versi ${version}` }).first()
  await expect(completeButton).toBeEnabled({ timeout: 20_000 })
  await completeButton.click()
  await page.getByRole('dialog').getByRole('button', { name: `Complete versi ${version}` }).click()
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

  await page.getByRole('button', { name: 'Buat SOP', exact: true }).click()
  await page.getByRole('button', { name: 'Buat dengan AI' }).click()
  await page.getByLabel('Apa proses yang ingin Anda dokumentasikan?').fill(
    'Petugas menerima permohonan, verifikator memeriksa kelengkapan, dokumen yang tidak lengkap dikembalikan, dan hasil diserahkan setelah lengkap.',
  )
  const generateButton = page.getByRole('button', { name: /Generate draft/i })
  await expect(generateButton).toBeEnabled({ timeout: 20_000 })
  await generateButton.click()
  await expect(page.getByText('Preview AI', { exact: true })).toBeVisible({ timeout: 20_000 })

  await page.getByLabel('Judul SOP').fill(title)
  await page.getByLabel('Nomor SOP').fill(`E2E-REVIEW-001-${testInfo.retry}`)
  await page.getByLabel('Nama lembaga').fill('Unit AI Review E2E')
  await page.getByRole('button', { name: 'Buat dan lanjutkan' }).click()
  await waitForAppHydration(page)

  await openEditorSection(page, '3. Prosedur')
  const activities = visibleProcedureField(page, 'Kegiatan')
  await expect(activities).toHaveCount(3)
  await activities.nth(1).fill(beforeReviewActivity)

  await openReview(page)
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
  await expect(page.getByRole('status').filter({ hasText: 'Tersimpan' })).toBeVisible({ timeout: 20_000 })

  await openReview(page)
  await expect(page.getByText('Periksa kembali routing keputusan', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Periksa dengan AI' })).toBeEnabled()

  await page.getByRole('button', { name: 'Periksa dengan AI' }).click()
  await expect(page.getByText('Periksa kembali routing keputusan', { exact: true })).toBeVisible({
    timeout: 20_000,
  })

  await openEditorSection(page, '3. Prosedur')
  await expect(visibleProcedureField(page, 'Kegiatan').nth(1)).toHaveValue(afterReviewActivity)

  await completeCurrentVersion(page, 1)
  await expect(page.getByRole('button', { name: 'Buat versi baru' }).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Periksa dengan AI' })).toHaveCount(0)

  const completedUrl = page.url()
  await page.getByRole('button', { name: 'Buat versi baru' }).first().click()
  await expect.poll(() => page.url(), { timeout: 20_000 }).not.toBe(completedUrl)
  await waitForAppHydration(page)
  await expect(page.getByText('v2', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review & Complete' })).toBeVisible()
  await openEditorSection(page, '3. Prosedur')
  await expect(visibleProcedureField(page, 'Kegiatan').nth(1)).toHaveValue(afterReviewActivity)
})
