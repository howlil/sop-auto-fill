import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { request, type FullConfig } from '@playwright/test'

import { users } from './fixtures/users'
import { apiBaseURL, apiHealthURL } from './support/api'

const clientDir = fileURLToPath(new URL('..', import.meta.url))
const serverDir = fileURLToPath(new URL('../../server', import.meta.url))

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const api = await request.newContext()
  try {
    const response = await api.get(apiHealthURL).catch(() => null)
    if (response === null || response.status() >= 500) {
      throw new Error(
        `Backend E2E tidak tersedia di ${apiHealthURL}. Jalankan server test sebelum Playwright.`,
      )
    }
  } finally {
    await api.dispose()
  }

  if (process.env.E2E_SEED === 'true') {
    execFileSync('pnpm', ['--dir', serverDir, 'db:seed:e2e'], {
      cwd: clientDir,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV ?? 'test',
      },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
  }

  if (process.env.E2E_SKIP_LOGIN_PREFLIGHT === 'true') return

  const loginApi = await request.newContext({ baseURL: apiBaseURL })
  try {
    const response = await loginApi.post(`${apiBaseURL}/auth/login`, {
      data: {
        email: users.pjEvaluator.email,
        password: users.pjEvaluator.password,
      },
    })

    if (!response.ok()) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `Backend E2E tersedia, tetapi login preflight gagal (${response.status()}) untuk ${users.pjEvaluator.email}. ` +
          `Pastikan database test sudah siap/seed benar. Response: ${body}`,
      )
    }
  } finally {
    await loginApi.dispose()
  }
}
