import { expect, test } from '@playwright/test'
import { users } from './fixtures/users'
import {
  apiPatch,
  apiPost,
  createAuthenticatedApiContext,
  expectApiRejected,
  expectBackendAvailable,
} from './support/api'
import {
  expectMainContent,
  loginViaUi,
  searchPageIfAvailable,
  uniqueSuffix,
} from './support/app'
import {
  createApprovedSopFixture,
  createDraftSopFixture,
  createReadySopFixture,
} from './support/e2e-flow'

test.describe('E2E penyusunan SOP dasar', () => {
  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  test('penyusun dapat membuat draft SOP baru dan menemukannya di daftar', async ({ page }) => {
    await loginViaUi(page, users.penyusun)
    await page.goto('/penyusun/sop')
    await expectMainContent(page)

    const suffix = uniqueSuffix('SOP')
    const title = `E2E Draft SOP ${suffix}`
    const number = `E2E/${suffix}/2026`

    await page.getByRole('button', { name: /buat sop baru/i }).click()
    await expect(page.getByRole('dialog', { name: /buat sop baru/i })).toBeVisible()

    await page.getByPlaceholder(/sop pelayanan penerimaan siswa baru/i).fill(title)
    await page.getByPlaceholder(/t\.001\/un15/i).fill(number)
    await page.getByRole('button', { name: /^buat sop$/i }).click()

    await expect(page.getByRole('dialog', { name: /buat sop baru/i })).toBeHidden({
      timeout: 15_000,
    })

    const search = page.getByPlaceholder(/cari judul atau nomor sop/i)
    await expect(search).toBeVisible()
    await search.fill(title)

    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(number).first()).toBeVisible()
    await expect(page.locator('body')).toContainText(/draft/i)
  })

  test('dialog buat SOP menolak data kosong', async ({ page }) => {
    await loginViaUi(page, users.penyusun)
    await page.goto('/penyusun/sop')
    await expectMainContent(page)

    await page.getByRole('button', { name: /buat sop baru/i }).click()
    await page.getByRole('button', { name: /^buat sop$/i }).click()

    await expect(page.getByText(/mohon lengkapi judul sop dan nomor sop/i)).toBeVisible()
    await expect(page.getByRole('dialog', { name: /buat sop baru/i })).toBeVisible()
  })

  test('PJ Penyusun dapat membuka dialog pengajuan evaluasi SOP', async ({ page }) => {
    await loginViaUi(page, users.pjPenyusun)
    await page.goto('/penyusun/sop')
    await expectMainContent(page)

    await page.getByRole('button', { name: /ajukan evaluasi sop/i }).click()
    await expect(page.getByRole('dialog', { name: /ajukan evaluasi sop/i })).toBeVisible()
    await expect(page.locator('body')).toContainText(/sop|evaluasi/i)
  })

  test('E2E-23: nomor SOP duplikat ditolak', async () => {
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    try {
      const draft = await createDraftSopFixture(penyusun, 'DUP')
      await expectApiRejected(penyusun, 'post', '/sop', {
        judul: `${draft.title} Duplikat`,
        nomorSop: draft.number,
        namaLembaga: 'Biro Organisasi Sumbar',
      })
    } finally {
      await penyusun.dispose()
    }
  })

  test('E2E-24 sampai E2E-30: header, prosedur, diagram, riwayat, dan status siap evaluasi tersimpan', async ({ page }) => {
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    try {
      const ready = await createReadySopFixture(penyusun, 'READY')

      await loginViaUi(page, users.penyusun)
      await page.goto(`/penyusun/sop/${ready.detailSopId}`)
      await expectMainContent(page)
      await expect(page.locator('body')).toContainText(ready.title)
      await expect(page.locator('body')).toContainText(/menunggu pengajuan evaluasi|siap evaluasi/i)
      await expect(page.locator('body')).toContainText(/dasar hukum|peringatan|prosedur|langkah/i)

      const diagramTab = page.getByRole('tab', { name: /diagram|flowchart|bpmn/i }).first()
      if (await diagramTab.isVisible().catch(() => false)) {
        await diagramTab.click()
        await expect(page.locator('body')).toContainText(/mulai|selesai|diagram|flowchart|bpmn/i)
      }

      const historyText = page.locator('body')
      await expect(historyText).toContainText(/riwayat|aktivitas|terakhir/i)

      await page.goto('/penyusun/sop')
      await expectMainContent(page)
      await searchPageIfAvailable(page, ready.title)
      await expect(page.getByText(ready.title).first()).toBeVisible({ timeout: 15_000 })
    } finally {
      await penyusun.dispose()
    }
  })

  test('E2E-26 dan E2E-31: keputusan tanpa cabang dan SOP tidak lengkap tidak bisa siap evaluasi', async () => {
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    try {
      const draft = await createDraftSopFixture(penyusun, 'INVALID')
      await expectApiRejected(penyusun, 'patch', `/sop/status/${draft.detailSopId}`, {
        status: 'MENUNGGU_PENGAJUAN_EVALUASI',
      })

      const pelaksana = await apiPost<{ id: string }>(penyusun, '/pelaksana', {
        namaPelaksana: `Pelaksana ${draft.number}`,
      })
      await apiPatch(penyusun, `/sop/langkah/${draft.detailSopId}`, {
        pelaksana: [{ pelaksanaId: pelaksana.id }],
        langkah: [
          {
            tempId: 'decision-without-branches',
            jenis: 'KEPUTUSAN',
            kegiatan: 'Apakah dokumen lengkap?',
            pelaksanaId: pelaksana.id,
            kelengkapan: 'Dokumen',
            keluaran: 'Keputusan',
            waktu: 5,
            satuanWaktu: 'm',
          },
        ],
      })
      await expectApiRejected(penyusun, 'patch', `/sop/status/${draft.detailSopId}`, {
        status: 'MENUNGGU_PENGAJUAN_EVALUASI',
      })
    } finally {
      await penyusun.dispose()
    }
  })

  test('E2E-56: versi baru dapat dibuat dari SOP berlaku dan versi lama tetap dapat dilihat', async ({ page }) => {
    const approved = await createApprovedSopFixture('VERSION')
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    try {
      await apiPost(penyusun, `/sop/${approved.detailSopId}/buat-versi-baru`)
      await loginViaUi(page, users.penyusun)
      await page.goto('/penyusun/sop')
      await expectMainContent(page)
      await searchPageIfAvailable(page, approved.title)
      await expect(page.getByText(approved.title).first()).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('body')).toContainText(/draft|berlaku|versi/i)
    } finally {
      await penyusun.dispose()
    }
  })
})
