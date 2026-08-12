import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { request, type FullConfig } from '@playwright/test'

const serverDir = fileURLToPath(new URL('../../server', import.meta.url))
const authStatePath = fileURLToPath(new URL('./.auth/user.json', import.meta.url))
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const apiBaseURL = process.env.E2E_API_BASE_URL ?? 'http://localhost:3001/api/v1'
const apiHealthURL = process.env.E2E_API_HEALTH_URL ?? 'http://localhost:3001/api/health'

type SeedResult = {
  user: {
    userId: string
    email: string
    name: string
  }
  accessToken: string
}

function parseSeedResult(output: string): SeedResult {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const value = JSON.parse(lines[index]) as Partial<SeedResult>
      if (value.accessToken && value.user?.userId && value.user.email && value.user.name) {
        return value as SeedResult
      }
    } catch {
      // pnpm may emit informational lines before the seed JSON.
    }
  }
  throw new Error('E2E seed tidak mengembalikan session JSON yang valid')
}

function seedSession(): SeedResult {
  const output = execFileSync(
    'pnpm',
    ['exec', 'ts-node', '--transpile-only', 'prisma/seed-e2e.ts'],
    {
      cwd: serverDir,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_TEST: '1',
      },
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  )
  return parseSeedResult(output)
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const health = await request.newContext()
  try {
    const response = await health.get(apiHealthURL).catch(() => null)
    if (response === null || !response.ok()) {
      throw new Error(`Backend E2E tidak tersedia di ${apiHealthURL}`)
    }
  } finally {
    await health.dispose()
  }

  const session = seedSession()
  const authenticatedApi = await request.newContext({
    extraHTTPHeaders: {
      Cookie: `access_token=${session.accessToken}`,
    },
  })
  try {
    const me = await authenticatedApi.get(`${apiBaseURL}/auth/me`)
    if (!me.ok()) {
      throw new Error(`JWT E2E ditolak oleh /auth/me (${me.status()})`)
    }
  } finally {
    await authenticatedApi.dispose()
  }

  const origin = new URL(baseURL)
  mkdirSync(dirname(authStatePath), { recursive: true })
  writeFileSync(
    authStatePath,
    JSON.stringify(
      {
        cookies: [
          {
            name: 'access_token',
            value: session.accessToken,
            domain: origin.hostname,
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: origin.protocol === 'https:',
            sameSite: 'Lax',
          },
        ],
        origins: [],
      },
      null,
      2,
    ),
  )
}
