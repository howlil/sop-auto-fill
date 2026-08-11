import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
} from '@playwright/test'
import type { E2eUser } from '../fixtures/users'

export const apiBaseURL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1'

export const apiHealthURL =
  process.env.E2E_API_HEALTH_URL ??
  apiBaseURL.replace(/\/api\/v1\/?$/, '/api/health')

export async function expectBackendAvailable(request: APIRequestContext): Promise<void> {
  const response = await request.get(apiHealthURL).catch(() => null)
  if (response === null || response.status() >= 500) {
    throw new Error(
      `Backend E2E tidak tersedia di ${apiHealthURL}. Jalankan server terlebih dahulu sebelum pnpm test:e2e.`,
    )
  }
}

export async function loginApi(
  request: APIRequestContext,
  user: E2eUser,
): Promise<{ data: Record<string, unknown>; cookieHeader: string }> {
  const response = await request.post(`${apiBaseURL}/auth/login`, {
    data: {
      email: user.email,
      password: user.password,
    },
  })
  await expect(response, `Login API untuk ${user.role}`).toBeOK()
  const json = (await response.json()) as { data?: Record<string, unknown> }
  return {
    data: json.data ?? {},
    cookieHeader: buildCookieHeader(response.headersArray()),
  }
}

export async function createAuthenticatedApiContext(
  user: E2eUser,
): Promise<APIRequestContext> {
  const loginContext = await playwrightRequest.newContext({
    baseURL: apiBaseURL,
  })
  try {
    const { cookieHeader } = await loginApi(loginContext, user)
    if (!cookieHeader) {
      throw new Error(`Login API untuk ${user.role} tidak mengembalikan Set-Cookie`)
    }
    const context = await playwrightRequest.newContext({
      baseURL: apiBaseURL,
      extraHTTPHeaders: {
        cookie: cookieHeader,
      },
    })
    const me = await context.get(`${apiBaseURL}/auth/me`)
    await expect(me, `Cookie API untuk ${user.role}`).toBeOK()
    return context
  } catch (error) {
    throw error
  } finally {
    await loginContext.dispose()
  }
}

export async function apiGet<T>(
  context: APIRequestContext,
  url: string,
): Promise<T> {
  const response = await context.get(toApiUrl(url))
  await expect(response, `GET ${url}`).toBeOK()
  return unwrapApiData<T>(await response.json())
}

export async function apiPost<T>(
  context: APIRequestContext,
  url: string,
  data?: unknown,
): Promise<T> {
  const response = await context.post(toApiUrl(url), data === undefined ? undefined : { data })
  await expect(response, `POST ${url}`).toBeOK()
  return unwrapApiData<T>(await response.json())
}

export async function apiPatch<T>(
  context: APIRequestContext,
  url: string,
  data?: unknown,
): Promise<T> {
  const response = await context.patch(toApiUrl(url), data === undefined ? undefined : { data })
  await expect(response, `PATCH ${url}`).toBeOK()
  return unwrapApiData<T>(await response.json())
}

export async function apiDelete<T>(
  context: APIRequestContext,
  url: string,
): Promise<T> {
  const response = await context.delete(toApiUrl(url))
  await expect(response, `DELETE ${url}`).toBeOK()
  return unwrapApiData<T>(await response.json())
}

export async function expectApiRejected(
  context: APIRequestContext,
  method: 'get' | 'post' | 'patch' | 'delete',
  url: string,
  data?: unknown,
): Promise<void> {
  const response = await context[method](toApiUrl(url), data === undefined ? undefined : { data })
  expect(response.status(), `${method.toUpperCase()} ${url} should be rejected`).toBeGreaterThanOrEqual(400)
}

export function toApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const path = url.startsWith('/') ? url : `/${url}`
  return `${apiBaseURL.replace(/\/$/, '')}${path}`
}

export function unwrapApiData<T>(json: unknown): T {
  if (
    typeof json === 'object' &&
    json !== null &&
    'data' in json
  ) {
    return (json as { data: T }).data
  }
  return json as T
}

function buildCookieHeader(headers: Array<{ name: string; value: string }>): string {
  return headers
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => header.value.split(';')[0])
    .filter(Boolean)
    .join('; ')
}
