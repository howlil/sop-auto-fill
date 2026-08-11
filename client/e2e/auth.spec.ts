import { expect, test } from '@playwright/test'
import { allUsers, users } from './fixtures/users'
import {
  apiDelete,
  apiPatch,
  apiPost,
  createAuthenticatedApiContext,
  expectApiRejected,
  expectBackendAvailable,
} from './support/api'
import { expectMainContent, loginViaUi, logoutViaUi, waitForAppReady } from './support/app'
import { e2eRunId, uniqueEmail } from './support/test-data'

test.describe('E2E Auth dan sesi pengguna', () => {
  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  for (const user of allUsers) {
    test(`login berhasil dan redirect landing role ${user.role}`, async ({ page }) => {
      await loginViaUi(page, user)
      await expect(page.getByRole('button', { name: /profil/i })).toBeVisible()
      await expect(page.locator('body')).toContainText(user.roleLabel)
    })
  }

  test('login gagal menampilkan validasi kredensial', async ({ page }) => {
    await page.goto('/login')
    await waitForAppReady(page)
    const emailInput = page.getByLabel('Email')
    await emailInput.fill('bukan-email')
    await page.locator('input#password, input[name="password"], input[type="password"]').first().fill('pendek')
    await page.getByRole('button', { name: /^masuk$/i }).click()

    await expect(emailInput).toHaveJSProperty('validity.valid', false)
    await expect(page).toHaveURL(/\/login/)
  })

  test('login gagal untuk password salah', async ({ page }) => {
    await page.goto('/login')
    await waitForAppReady(page)
    await page.getByLabel('Email').fill(users.penyusun.email)
    await page.locator('input#password, input[name="password"], input[type="password"]').first().fill('PasswordSalah123')
    await page.getByRole('button', { name: /^masuk$/i }).click()

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText(/login gagal|tidak valid|email atau kata sandi/i)).toBeVisible()
  })

  test('akses route terlindungi tanpa login diarahkan ke login', async ({ page }) => {
    await page.goto('/penyusun/sop')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByLabel('Email')).toBeVisible()
  })

  test('logout menghapus sesi dan route terlindungi kembali meminta login', async ({ page }) => {
    await loginViaUi(page, users.penyusun)
    await logoutViaUi(page)
    await expectMainContent(page)

    await page.goto('/penyusun/sop')
    await expect(page).toHaveURL(/\/login/)
  })

  test('E2E-06 dan E2E-07: ubah kata sandi berhasil dan gagal pada akun test terisolasi', async () => {
    const admin = await createAuthenticatedApiContext(users.pjEvaluator)
    let opdId: string | undefined
    let penyusunId: string | undefined
    try {
      const suffix = e2eRunId('PASS')
      const opd = await apiPost<{ id: string }>(admin, '/opd', { nama: `OPD Password ${suffix}` })
      opdId = opd.id
      const email = uniqueEmail('password')
      const created = await apiPost<{ id: string }>(admin, '/penyusun', {
        opdId,
        email,
        nama: `Penyusun Password ${suffix}`,
        nip: `PASS-${suffix}`,
        peran: 'PENYUSUN',
        jabatan: 'Penyusun SOP',
        pangkat: 'Penata',
        nohp: '081234567893',
      })
      penyusunId = created.id

      const user = {
        ...users.penyusun,
        email,
        password: process.env.E2E_SEED_PASSWORD ?? '@Password123:)',
      }
      const context = await createAuthenticatedApiContext(user)
      try {
        await expectApiRejected(context, 'patch', '/auth/change-password', {
          kataSandiLama: 'SandiSalah',
          kataSandiBaru: '@Password123:)Baru',
        })
        await apiPatch(context, '/auth/change-password', {
          kataSandiLama: user.password,
          kataSandiBaru: '@Password123:)Baru',
        })
      } finally {
        await context.dispose()
      }

      const changedUser = { ...user, password: '@Password123:)Baru' }
      const changedContext = await createAuthenticatedApiContext(changedUser)
      await changedContext.dispose()
    } finally {
      if (penyusunId) await apiDelete(admin, `/penyusun/${penyusunId}`).catch(() => undefined)
      if (opdId) await apiDelete(admin, `/opd/${opdId}`).catch(() => undefined)
      await admin.dispose()
    }
  })
})
