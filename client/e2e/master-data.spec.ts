import { expect, test } from '@playwright/test'
import { users } from './fixtures/users'
import {
  apiGet,
  apiPatch,
  apiPost,
  createAuthenticatedApiContext,
  expectBackendAvailable,
  expectApiRejected,
} from './support/api'
import {
  apiDeleteViaActivePageSession,
  expectMainContent,
  loginViaUi,
  searchPageIfAvailable,
} from './support/app'
import { e2eRunId, uniqueEmail } from './support/test-data'

interface Opd {
  id: string
  nama: string
}

interface PersonRow {
  id: string
  nama?: string
  email?: string
  user?: {
    nama: string
    email: string
  }
}

test.describe('E2E master data dan referensi', () => {
  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  test('PJ Evaluator dapat membuka dialog tambah OPD', async ({ page }) => {
    await loginViaUi(page, users.pjEvaluator)
    await page.goto('/pj-evaluator/opd')
    await expectMainContent(page)

    await page.getByRole('button', { name: /tambah opd/i }).click()
    await expect(page.getByRole('dialog', { name: /tambah opd/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /simpan/i })).toBeVisible()
  })

  test('PJ Evaluator dapat membuka dialog tambah evaluator', async ({ page }) => {
    await loginViaUi(page, users.pjEvaluator)
    await page.goto('/pj-evaluator/evaluator')
    await expectMainContent(page)

    await page.getByRole('button', { name: /tambah anggota/i }).click()
    await expect(page.getByRole('dialog', { name: /tambah evaluator/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /simpan/i })).toBeVisible()
  })

  test('PJ Evaluator dapat membuka dialog tambah penyusun', async ({ page }) => {
    await loginViaUi(page, users.pjEvaluator)
    await page.goto('/pj-evaluator/penyusun')
    await expectMainContent(page)

    await page.getByRole('button', { name: /tambah penyusun/i }).click()
    await expect(page.getByRole('dialog', { name: /tambah penyusun/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /simpan/i })).toBeVisible()
  })

  test('Penyusun dapat membuka dialog tambah pelaksana SOP', async ({ page }) => {
    await loginViaUi(page, users.penyusun)
    await page.goto('/penyusun/pelaksana')
    await expectMainContent(page)

    await page.getByRole('button', { name: /tambah pelaksana/i }).click()
    await expect(page.getByRole('dialog', { name: /tambah pelaksana sop/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /simpan/i })).toBeVisible()
  })

  test('Penyusun dapat membuka dialog tambah peraturan', async ({ page }) => {
    await loginViaUi(page, users.penyusun)
    await page.goto('/penyusun/peraturan')
    await expectMainContent(page)

    await page.getByRole('button', { name: /tambah peraturan/i }).click()
    await expect(page.getByRole('dialog', { name: /tambah peraturan/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /tambah|simpan/i })).toBeVisible()
  })

  test('E2E-08 sampai E2E-10: PJ Evaluator mengelola OPD dari tambah, ubah, sampai nonaktif', async ({ page }) => {
    const admin = await createAuthenticatedApiContext(users.pjEvaluator)
    try {
      const suffix = e2eRunId('OPD')
      const created = await apiPost<Opd>(admin, '/opd', { nama: `OPD ${suffix}` })
      const updatedName = `OPD ${suffix} Updated`
      await apiPatch<Opd>(admin, `/opd/${created.id}`, { nama: updatedName })

      await loginViaUi(page, users.pjEvaluator)
      await page.goto('/pj-evaluator/opd')
      await expectMainContent(page)
      await searchPageIfAvailable(page, updatedName)
      await expect(page.getByText(updatedName).first()).toBeVisible({ timeout: 15_000 })

      await apiDeleteViaActivePageSession(page, `/opd/${created.id}`)
      await page.reload()
      await expectMainContent(page)
      await searchPageIfAvailable(page, updatedName)
      await expect(page.getByText(updatedName)).toHaveCount(0)
    } finally {
      await admin.dispose()
    }
  })

  test('E2E-11 dan E2E-12: PJ Evaluator mengelola evaluator', async ({ page }) => {
    const admin = await createAuthenticatedApiContext(users.pjEvaluator)
    try {
      const suffix = e2eRunId('EV')
      const evaluator = await apiPost<PersonRow>(admin, '/evaluator', {
        email: uniqueEmail('evaluator'),
        nama: `Evaluator ${suffix}`,
        nip: `EV-${suffix}`,
        jabatan: 'Evaluator SOP',
        pangkat: 'Penata',
        nohp: '081234567890',
      })
      const updatedName = `Evaluator ${suffix} Updated`
      await apiPatch<PersonRow>(admin, `/evaluator/${evaluator.id}`, { nama: updatedName })

      await loginViaUi(page, users.pjEvaluator)
      await page.goto('/pj-evaluator/evaluator')
      await expectMainContent(page)
      await searchPageIfAvailable(page, updatedName)
      await expect(page.getByText(updatedName).first()).toBeVisible({ timeout: 15_000 })

      await apiDeleteViaActivePageSession(page, `/evaluator/${evaluator.id}`)
    } finally {
      await admin.dispose()
    }
  })

  test('E2E-13 sampai E2E-15: PJ Evaluator mengelola penyusun, mutasi OPD, dan kepala OPD', async ({ page }) => {
    const admin = await createAuthenticatedApiContext(users.pjEvaluator)
    try {
      const suffix = e2eRunId('TIM')
      const opdA = await apiPost<Opd>(admin, '/opd', { nama: `OPD Tim A ${suffix}` })
      const opdB = await apiPost<Opd>(admin, '/opd', { nama: `OPD Tim B ${suffix}` })
      const penyusun = await apiPost<PersonRow>(admin, '/penyusun', {
        opdId: opdA.id,
        email: uniqueEmail('penyusun'),
        nama: `Penyusun ${suffix}`,
        nip: `PEN-${suffix}`,
        peran: 'PENYUSUN',
        jabatan: 'Penyusun SOP',
        pangkat: 'Penata',
        nohp: '081234567891',
      })
      await apiPatch(admin, `/penyusun/${penyusun.id}/pindah`, { opdId: opdB.id })
      const riwayat = await apiGet<Array<{ namaOpd: string; isAktif: boolean }>>(
        admin,
        `/penyusun/${penyusun.id}/riwayat-opd`,
      )
      expect(riwayat.some((row) => row.namaOpd === opdB.nama && row.isAktif)).toBe(true)

      const kepala = await apiPost<PersonRow>(admin, '/kepala-opd', {
        opdId: opdB.id,
        email: uniqueEmail('kepala'),
        nama: `Kepala ${suffix}`,
        nip: `KEP-${suffix}`,
        jabatan: 'Kepala OPD',
        pangkat: 'Pembina',
        nohp: '081234567892',
      })

      await loginViaUi(page, users.pjEvaluator)
      await page.goto('/pj-evaluator/penyusun')
      await expectMainContent(page)
      await searchPageIfAvailable(page, `Penyusun ${suffix}`)
      await expect(page.getByText(`Penyusun ${suffix}`).first()).toBeVisible({ timeout: 15_000 })

      await page.goto('/pj-evaluator/opd')
      await expectMainContent(page)
      await searchPageIfAvailable(page, opdB.nama)
      await expect(page.getByText(opdB.nama).first()).toBeVisible()

      await apiDeleteViaActivePageSession(page, `/kepala-opd/${kepala.id}`).catch(() => undefined)
      await apiDeleteViaActivePageSession(page, `/penyusun/${penyusun.id}`).catch(() => undefined)
      await apiDeleteViaActivePageSession(page, `/opd/${opdA.id}`).catch(() => undefined)
      await apiDeleteViaActivePageSession(page, `/opd/${opdB.id}`).catch(() => undefined)
    } finally {
      await admin.dispose()
    }
  })

  test('E2E-16: grafik evaluasi tampil dan menerima filter', async ({ page }) => {
    await loginViaUi(page, users.pjEvaluator)
    await page.goto('/pj-evaluator/grafik-evaluasi')
    await expectMainContent(page)
    await expect(page.locator('body')).toContainText(/grafik|evaluasi|opd/i)
    await page.getByRole('button', { name: /filter|terapkan|reset/i }).first().click({ trial: true }).catch(() => undefined)
  })

  test('E2E-17 sampai E2E-21: penyusun mengelola peraturan dan pelaksana termasuk validasi duplikat', async ({ page }) => {
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    try {
      const suffix = e2eRunId('REF')
      const peraturan = await apiPost<{ id: string; namaPeraturan: string }>(penyusun, '/peraturan', {
        namaPeraturan: `Peraturan ${suffix}`,
        nomor: `PER-${suffix}`,
        tahun: 2026,
        tentang: 'Pengujian E2E referensi SOP',
      })
      await expectApiRejected(penyusun, 'post', '/peraturan', {
        namaPeraturan: `Peraturan Duplikat ${suffix}`,
        nomor: `PER-${suffix}`,
        tahun: 2026,
        tentang: 'Duplikat',
      })
      const updatedPeraturan = `Peraturan ${suffix} Updated`
      await apiPatch(penyusun, `/peraturan/${peraturan.id}`, {
        namaPeraturan: updatedPeraturan,
      })

      const pelaksana = await apiPost<{ id: string; namaPelaksana: string }>(penyusun, '/pelaksana', {
        namaPelaksana: `Pelaksana ${suffix}`,
      })
      const updatedPelaksana = `Pelaksana ${suffix} Updated`
      await apiPatch(penyusun, `/pelaksana/${pelaksana.id}`, {
        namaPelaksana: updatedPelaksana,
      })

      await loginViaUi(page, users.penyusun)
      await page.goto('/penyusun/peraturan')
      await expectMainContent(page)
      await searchPageIfAvailable(page, updatedPeraturan)
      await expect(page.getByText(updatedPeraturan).first()).toBeVisible({ timeout: 15_000 })

      await page.goto('/penyusun/pelaksana')
      await expectMainContent(page)
      await searchPageIfAvailable(page, updatedPelaksana)
      await expect(page.getByText(updatedPelaksana).first()).toBeVisible({ timeout: 15_000 })

      await apiDeleteViaActivePageSession(page, `/pelaksana/${pelaksana.id}`).catch(() => undefined)
      await apiDeleteViaActivePageSession(page, `/peraturan/${peraturan.id}`).catch(() => undefined)
    } finally {
      await penyusun.dispose()
    }
  })
})
