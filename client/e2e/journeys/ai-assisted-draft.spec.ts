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

test('AI draft preview confirms into a normal SOP and preserves the existing lifecycle', async ({ page }, testInfo) => {
  const workspaceName = `E2E AI Workspace ${testInfo.retry}`
  const reusedActor = 'Petugas Layanan'
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

  await page.getByPlaceholder('Nama pelaksana').fill(reusedActor)
  await page.getByRole('button', { name: 'Tambah Pelaksana' }).click()
  await expect(
    page.getByLabel('Daftar pelaksana workspace').getByText(reusedActor, { exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Dengan AI' }).click()
  await page.getByLabel('Deskripsi proses').fill(
    'Petugas menerima permohonan layanan, verifikator memeriksa kelengkapan, permohonan tidak lengkap dikembalikan, dan hasil layanan diserahkan setelah lengkap.',
  )
  await page.getByLabel('Tujuan proses (opsional)').fill('Memastikan pelayanan konsisten dan terdokumentasi.')
  await page.getByLabel('Catatan tambahan (opsional)').fill('Gunakan alur koreksi jika dokumen tidak lengkap.')

  const generateButton = page.getByRole('button', { name: 'Generate Draft' })
  await expect(generateButton).toBeEnabled({ timeout: 20_000 })
  await generateButton.click()

  await expect(
    page.getByText('Konten ini dihasilkan AI dan harus ditinjau sebelum digunakan.'),
  ).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('3 langkah', { exact: true })).toBeVisible()
  const reusedActorsPreview = page.getByText('Aktor dipakai ulang', { exact: true }).locator('..')
  const newActorsPreview = page.getByText('Aktor baru', { exact: true }).locator('..')
  await expect(reusedActorsPreview).toContainText(reusedActor)
  await expect(newActorsPreview).toContainText('Verifikator')

  await expect(page.getByPlaceholder('Judul SOP')).toHaveValue('SOP Pelayanan Permohonan')
  await page.getByPlaceholder('Judul SOP').fill(title)
  await page.getByPlaceholder('Nomor SOP').fill(`E2E-AI-001-${testInfo.retry}`)
  await page.getByPlaceholder('Nama lembaga').fill('Unit Pelayanan AI E2E')
  await page.getByRole('button', { name: 'Buat Draft SOP' }).click()
  await waitForAppHydration(page)

  await expect(page.getByText('Dokumen SOP', { exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('Judul SOP')).toHaveValue(title)
  await expect(page.getByPlaceholder('Peringatan 1')).toHaveValue(
    'Pastikan data pemohon telah diverifikasi',
  )

  await page.getByRole('button', { name: 'Langkah' }).click()
  const activities = visibleProcedureField(page, 'Kegiatan')
  await expect(activities).toHaveCount(3)
  await expect(activities.nth(1)).toHaveValue('Memverifikasi kelengkapan')
  await activities.nth(1).fill(updatedActivity)
  await expect(page.getByRole('status').filter({ hasText: 'Tersimpan' })).toBeVisible({
    timeout: 20_000,
  })

  await page.reload()
  await waitForAppHydration(page)
  await page.getByRole('button', { name: 'Langkah' }).click()
  await expect(visibleProcedureField(page, 'Kegiatan').nth(1)).toHaveValue(updatedActivity)
  await page.getByRole('button', { name: 'Selesai edit' }).click()

  await page.getByRole('tab', { name: 'BPMN' }).click()
  await expect(page.locator('.sop-print-diagram-bpmn')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('tab', { name: 'Flowchart' }).click()
  await expect(page.locator('.sop-print-diagram-flowchart')).toBeVisible({ timeout: 20_000 })

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
  await expect(page.getByPlaceholder('Judul SOP')).toHaveValue(title)
  await page.getByRole('button', { name: 'Langkah' }).click()
  await expect(visibleProcedureField(page, 'Kegiatan').nth(1)).toHaveValue(updatedActivity)
  await page.getByRole('button', { name: 'Selesai edit' }).click()
  await expect(page.getByText('v2', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Selesai' })).toBeVisible()
})
