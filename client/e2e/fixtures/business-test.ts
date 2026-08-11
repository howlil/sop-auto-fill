import {
  expect,
  request as playwrightRequest,
  test as base,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test'

import { apiBaseURL } from '../support/api'
import type { E2eUser, RoleKey } from './users'

const browserApiBaseURL =
  process.env.E2E_BROWSER_API_BASE_URL ?? apiBaseURL.replace('127.0.0.1', 'localhost')

type BrowserStorageState = Awaited<ReturnType<APIRequestContext['storageState']>>

interface RoleAuthBundle {
  api: APIRequestContext
  browserStorageState: BrowserStorageState
}

export interface RoleSession {
  user: E2eUser
  context: BrowserContext
  page: Page
  /** Shared worker API context khusus setup/post-condition audit. */
  api: APIRequestContext
  runtimeErrors: string[]
}

export type RoleSessionFactory = (user: E2eUser) => Promise<RoleSession>
export type RoleApiFactory = (user: E2eUser) => Promise<APIRequestContext>
type RoleStorageStateFactory = (user: E2eUser) => Promise<BrowserStorageState>
type RoleAuthFactory = (user: E2eUser) => Promise<RoleAuthBundle>

interface BusinessTestFixtures {
  roleSession: RoleSessionFactory
  /** Browser tanpa cookie/localStorage untuk mengaudit permukaan publik. */
  publicPage: Page
}

interface BusinessWorkerFixtures {
  roleAuth: RoleAuthFactory
  roleApi: RoleApiFactory
  roleStorageState: RoleStorageStateFactory
}

/**
 * Fixture khusus business-journey.
 *
 * Satu login dibuat per role per worker. Browser memakai storage state asli dari
 * host login, sedangkan API precondition/audit memakai Cookie header dari respons
 * login yang sama. Dengan begitu host-only cookie tidak dipalsukan dan rate limit
 * produksi tidak dilonggarkan hanya untuk test.
 */
export const test = base.extend<BusinessTestFixtures, BusinessWorkerFixtures>({
  roleAuth: [
    async ({}, use) => {
      const bundles = new Map<RoleKey, RoleAuthBundle>()

      await use(async (user) => {
        const existing = bundles.get(user.role)
        if (existing) return existing

        const authContext = await playwrightRequest.newContext({ baseURL: browserApiBaseURL })
        try {
          const login = await authContext.post(`${browserApiBaseURL}/auth/login`, {
            data: {
              email: user.email,
              password: user.password,
            },
          })
          if (!login.ok()) {
            const body = await login.text().catch(() => '')
            throw new Error(`Precondition auth ${user.role} gagal (${login.status()}): ${body}`)
          }

          const browserStorageState = await authContext.storageState()
          const cookieHeader = login
            .headersArray()
            .filter((header) => header.name.toLowerCase() === 'set-cookie')
            .map((header) => header.value.split(';')[0])
            .filter(Boolean)
            .join('; ')
          if (!cookieHeader) {
            throw new Error(`Precondition auth ${user.role} tidak mengembalikan Set-Cookie`)
          }

          const api = await playwrightRequest.newContext({
            baseURL: apiBaseURL,
            extraHTTPHeaders: { cookie: cookieHeader },
          })
          const me = await api.get(`${apiBaseURL}/auth/me`)
          if (!me.ok()) {
            const body = await me.text().catch(() => '')
            await api.dispose()
            throw new Error(`Cookie API ${user.role} gagal (${me.status()}): ${body}`)
          }

          const bundle = { api, browserStorageState }
          bundles.set(user.role, bundle)
          return bundle
        } finally {
          await authContext.dispose()
        }
      })

      await Promise.allSettled([...bundles.values()].map(({ api }) => api.dispose()))
    },
    { scope: 'worker' },
  ],

  roleApi: [
    async ({ roleAuth }, use) => {
      await use(async (user) => (await roleAuth(user)).api)
    },
    { scope: 'worker' },
  ],

  roleStorageState: [
    async ({ roleAuth }, use) => {
      await use(async (user) => (await roleAuth(user)).browserStorageState)
    },
    { scope: 'worker' },
  ],

  publicPage: async ({ browser }, use, testInfo) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()
    const runtimeErrors: string[] = []
    page.on('pageerror', (error) => runtimeErrors.push(error.message))

    await use(page)
    await context.close()

    if (testInfo.status === testInfo.expectedStatus) {
      expect(runtimeErrors, 'public journey tidak boleh menghasilkan pageerror').toEqual([])
    }
  },

  roleSession: async ({ browser, roleApi, roleStorageState }, use, testInfo) => {
    const sessions: RoleSession[] = []

    await use(async (user) => {
      const context = await browser.newContext({ storageState: await roleStorageState(user) })
      const page = await context.newPage()
      const runtimeErrors: string[] = []
      page.on('pageerror', (error) => runtimeErrors.push(error.message))

      const session: RoleSession = {
        user,
        context,
        page,
        api: await roleApi(user),
        runtimeErrors,
      }
      sessions.push(session)
      return session
    })

    const runtimeErrors = sessions.flatMap((session) =>
      session.runtimeErrors.map((message) => `${session.user.role}: ${message}`),
    )

    await Promise.allSettled(sessions.map((session) => session.context.close()))

    // Jangan menutupi error utama test dengan assertion teardown kedua.
    if (testInfo.status === testInfo.expectedStatus) {
      expect(runtimeErrors, 'business journey tidak boleh menghasilkan pageerror').toEqual([])
    }
  },
})

export { expect }