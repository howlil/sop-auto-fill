import { expect, type Page } from '@playwright/test'

import { expectMainContent, searchPageIfAvailable, waitForAppReady } from './app'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function submitEvaluationViaUi(
  page: Page,
  sopTitles: string[],
): Promise<void> {
  await page.goto('/penyusun/sop')
  await expectMainContent(page)
  await page.getByRole('button', { name: /ajukan evaluasi sop/i }).click()

  const dialog = page.getByRole('dialog', { name: /ajukan evaluasi sop/i })
  await expect(dialog).toBeVisible()
  for (const title of sopTitles) {
    const item = dialog.locator('li').filter({ hasText: title })
    await expect(item, `SOP ${title} harus tersedia untuk diajukan`).toBeVisible()
    await item.locator('input[type="checkbox"]').check()
  }

  // Request OPD dipilih supaya journey berfokus pada lifecycle SOP, bukan scoring OPD.
  await dialog.getByRole('button', { name: 'Request OPD', exact: true }).click()
  await dialog.getByRole('button', { name: /ajukan evaluasi$/i }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

export async function openEvaluatorSubmission(
  page: Page,
  pengajuanId: string,
): Promise<void> {
  await page.goto(`/evaluator/evaluasi/pengajuan/${pengajuanId}`)
  await expectMainContent(page)
  await expect(page.getByRole('button', { name: /ajukan persetujuan evaluasi/i })).toBeVisible()
}

export async function evaluateSopViaUi(
  page: Page,
  params: {
    title: string
    result: 'SESUAI' | 'PERLU_PERBAIKAN'
    note?: string
  },
): Promise<void> {
  const titlePattern = new RegExp(escapeRegExp(params.title), 'i')
  const sopButton = page.getByRole('button', { name: titlePattern }).first()
  await expect(sopButton, `SOP ${params.title} harus tersedia di workspace evaluator`).toBeVisible()
  await sopButton.click()
  await expect(
    sopButton,
    `SOP ${params.title} harus menjadi dokumen aktif sebelum penilaian diubah`,
  ).toHaveAttribute('aria-pressed', 'true')

  const optionName = params.result === 'SESUAI' ? /^sesuai$/i : /^perlu perbaikan$/i
  const option = page.getByRole('radio', { name: optionName })

  // Pada penilaian ulang, UI sengaja menampilkan keputusan sebelumnya terlebih dahulu.
  // Evaluator harus memilih "Ubah Penilaian" untuk membuka kontrol keputusan baru.
  if (!(await option.isVisible())) {
    const editAssessment = page.getByRole('button', { name: /ubah penilaian/i })
    await expect(
      editAssessment,
      'Penilaian aktif tidak tersedia dan kontrol Ubah Penilaian juga tidak muncul',
    ).toBeVisible()
    await editAssessment.click()
  }

  await expect(option).toBeVisible()
  await option.click()

  if (params.result === 'PERLU_PERBAIKAN') {
    const note = params.note?.trim()
    if (!note) throw new Error('PERLU_PERBAIKAN wajib memiliki catatan pada journey')
    await page.getByPlaceholder(/catatan untuk penyusun/i).fill(note)
  }

  const lockLabel = params.result === 'SESUAI' ? /tandai sesuai/i : /ajukan perbaikan/i
  await page.getByRole('button', { name: lockLabel }).click()
  await expect(page.getByRole('button', { name: /ubah penilaian/i })).toBeVisible()
}

export async function submitEvaluationCompletionViaUi(
  page: Page,
  baNumber: string,
): Promise<void> {
  await page.getByRole('button', { name: /ajukan persetujuan evaluasi/i }).click()
  const dialog = page.getByRole('dialog', { name: /ajukan tanda tangan berita acara/i })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(/nomor berita acara/i).fill(baNumber)
  await dialog.getByRole('button', { name: /ya, ajukan ba/i }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

export async function expectEvaluationCompletionBlockedViaUi(page: Page): Promise<void> {
  await page.getByRole('button', { name: /ajukan persetujuan evaluasi/i }).click()
  const dialog = page.getByRole('dialog', { name: /ajukan tanda tangan berita acara/i })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(/belum|perbaikan|selesai|sesuai/i)
  await expect(dialog.getByRole('button', { name: /ya, ajukan ba/i })).toBeDisabled()
  await dialog.getByRole('button', { name: /^batal$/i }).click()
}

export async function rejectEvaluationViaUi(
  page: Page,
  reason: string,
): Promise<void> {
  await page.getByRole('button', { name: /tolak pengajuan/i }).click()
  const dialog = page.getByRole('dialog', { name: /tolak pengajuan evaluasi/i })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(/alasan penolakan/i).fill(reason)
  await dialog.getByRole('button', { name: /ya, tolak pengajuan/i }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

export async function reviseAndCompleteFollowUpViaUi(
  page: Page,
  params: {
    detailSopId: string
    note: string
    revisedTitle: string
  },
): Promise<void> {
  await page.goto(`/penyusun/sop/${params.detailSopId}`)
  await expectMainContent(page)

  const commentsTab = page.getByRole('tab', { name: /komentar evaluasi/i })
  await expect(commentsTab).toBeVisible()
  await commentsTab.click()
  await expect(page.getByText(params.note, { exact: true })).toBeVisible()

  // Perubahan kecil membuktikan bahwa versi revisi benar-benar editable dari UI.
  const editTab = page.getByRole('tab', { name: /^edit$/i })
  await expect(editTab).toBeVisible()
  await editTab.click()
  const titleInput = page.getByPlaceholder('Judul SOP')
  await expect(titleInput).toBeVisible()
  await titleInput.fill(params.revisedTitle)
  const autosaveStatus = page.getByRole('status', { name: 'Status autosave header SOP' })
  await expect(autosaveStatus).toContainText(/tersimpan/i, { timeout: 15_000 })

  await commentsTab.click()
  const complete = page.getByRole('button', { name: /tandai tindak lanjut selesai/i })
  await expect(complete).toBeVisible()
  await complete.click()
  await expect(page.locator('body')).toContainText(/tindak lanjut.*selesai|selesai/i)
}

export async function resubmitRevisionViaUi(page: Page, detailSopId: string): Promise<void> {
  await page.goto(`/penyusun/sop/${detailSopId}`)
  await expectMainContent(page)
  const button = page.getByRole('button', { name: /kirim ulang evaluasi/i })
  await expect(button).toBeEnabled()
  await button.click()
  const dialog = page.getByRole('dialog', { name: /kirim ulang evaluasi/i })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /ya, kirim ulang/i }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

async function submitPinDialog(page: Page, buttonName: RegExp, pin: string): Promise<void> {
  const trigger = page.getByRole('button', { name: buttonName })
  await expect(trigger).toBeVisible()
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByPlaceholder(/masukkan pin/i).fill(pin)
  await dialog.getByRole('button', { name: /^tanda tangan(?:i)?$/i }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

export async function signBaAsPjEvaluatorViaUi(
  page: Page,
  pengajuanId: string,
  pin: string,
): Promise<void> {
  await page.goto(`/pj-evaluator/evaluasi/${pengajuanId}`)
  await expectMainContent(page)
  await submitPinDialog(page, /tanda tangan ba/i, pin)
}

export async function signBaAsPjPenyusunViaUi(
  page: Page,
  pengajuanId: string,
  pin: string,
): Promise<void> {
  await page.goto(`/penyusun/pj-penyusun/berita-acara/${pengajuanId}`)
  await expectMainContent(page)
  await submitPinDialog(page, /tanda tangan tte/i, pin)
}

export async function approveAllSopAsHeadViaUi(
  page: Page,
  pengajuanId: string,
  pin: string,
): Promise<void> {
  await page.goto(`/kepala-opd/pengajuan/${pengajuanId}`)
  await expectMainContent(page)
  await submitPinDialog(page, /tanda tangan semua sop/i, pin)
}

export async function createVersionViaUi(
  page: Page,
  detailSopId: string,
): Promise<string> {
  await page.goto(`/penyusun/sop/${detailSopId}`)
  await expectMainContent(page)
  await page.getByRole('button', { name: /^buat versi baru$/i }).first().click()
  const dialog = page.getByRole('dialog', { name: /buat versi baru/i })
  await expect(dialog).toBeVisible()

  const previousPath = new URL(page.url()).pathname
  await dialog.getByRole('button', { name: /^buat versi baru$/i }).click()
  await page.waitForURL(
    (url) => url.pathname.startsWith('/penyusun/sop/') && url.pathname !== previousPath,
    { timeout: 15_000 },
  )
  const nextId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)
  if (!nextId || nextId === detailSopId) {
    throw new Error('UI tidak berpindah ke detail versi baru')
  }
  await expect(page.locator('body')).toContainText(/draft|versi/i)
  return nextId
}

export async function revokeSopViaUi(
  page: Page,
  sopId: string,
): Promise<void> {
  await page.goto(`/kepala-opd/sop/${sopId}`)
  await expectMainContent(page)
  await page.getByRole('button', { name: /cabut sop/i }).click()
  const dialog = page.getByRole('dialog', { name: /cabut sop/i })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /ya, cabut sop/i }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
  await expect(page.locator('body')).toContainText(/dicabut/i)
}

export async function expectPublicArchiveContains(
  page: Page,
  title: string,
): Promise<void> {
  await page.goto('/arsip')
  await waitForAppReady(page)
  await searchPageIfAvailable(page, title)
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 })
}

export async function expectPublicArchiveExcludes(
  page: Page,
  title: string,
): Promise<void> {
  await page.goto('/arsip')
  await waitForAppReady(page)
  await searchPageIfAvailable(page, title)
  await expect(page.getByText(title)).toHaveCount(0)
}
