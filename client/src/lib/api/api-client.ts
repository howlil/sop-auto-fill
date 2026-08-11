import { resolveApiBaseUrl } from '@/config/env'

export function buildQueryString(
  params: Record<string, unknown> | undefined,
): string {
  if (!params) return ''
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null) searchParams.append(key, String(item))
      }
      continue
    }
    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

function getApiBaseUrl(): string {
  return resolveApiBaseUrl()
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function getHeaders(method = 'GET'): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  // Bukan secret. Header ini memaksa request browser melewati CORS/preflight rules,
  // lalu server tetap memvalidasi Origin dan Sec-Fetch-Site untuk cookie-auth.
  if (!SAFE_METHODS.has(method.toUpperCase())) {
    headers['X-CSRF-Token'] = '1'
  }

  return headers
}

export class ApiError extends Error {
  status: number
  code?: string
  errors?: string[]

  constructor(status: number, message: string, code?: string, errors?: string[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
  }
}

interface ErrorResponseBody {
  message?: string
  errors?: string[]
  error?: string[]
  code?: string
  statusCode?: number
  status?: number
}

function extractErrors(errorBody: ErrorResponseBody): {
  message: string
  errors?: string[]
  code?: string
} {
  const errors = Array.isArray(errorBody.errors)
    ? errorBody.errors
    : Array.isArray(errorBody.error)
      ? errorBody.error
      : undefined

  const message = errors
    ? errors.join('\n')
    : errorBody.message || `HTTP ${errorBody.statusCode || errorBody.status || 'unknown'}`

  const code = 'code' in errorBody ? (errorBody.code as string) : undefined
  return { message, errors, code }
}

interface QueuedRequest<T = unknown> {
  endpoint: string
  options: RequestInit
  resolve: (value: T) => void
  reject: (reason: unknown) => void
  retryCount: number
}

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null
let requestQueue: QueuedRequest<unknown>[] = []

function processRequestQueue() {
  const queue = [...requestQueue]
  requestQueue = []

  queue.forEach(({ endpoint, options, resolve, reject, retryCount }) => {
    request(endpoint, options, retryCount)
      .then((result) => resolve(result as unknown))
      .catch(reject)
  })
}

function rejectRequestQueue(error: Error | ApiError) {
  const queue = [...requestQueue]
  requestQueue = []
  queue.forEach(({ reject }) => reject(error))
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const url = `${getApiBaseUrl()}/auth/refresh`
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders('POST'),
      credentials: 'include',
    })

    return response.ok
  } catch {
    return false
  }
}

function waitForRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true
  refreshPromise = refreshAccessToken()
  refreshPromise
    .then((success) => {
      if (success) {
        processRequestQueue()
      } else {
        rejectRequestQueue(new ApiError(401, 'Token refresh failed'))
      }
    })
    .catch((error) => {
      rejectRequestQueue(error)
    })
    .finally(() => {
      isRefreshing = false
      refreshPromise = null
    })

  return refreshPromise
}

const REQUEST_TIMEOUT = 15000

async function request<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
  if (isRefreshing && retryCount === 0) {
    return new Promise<T>((resolve, reject) => {
      requestQueue.push({
        endpoint,
        options,
        resolve: resolve as (value: unknown) => void,
        reject,
        retryCount,
      })
    })
  }

  const url = `${getApiBaseUrl()}${endpoint}`
  const method = (options.method ?? 'GET').toUpperCase()
  const mergedHeaders = { ...getHeaders(method), ...options.headers }
  const headers = Object.fromEntries(
    Object.entries(mergedHeaders).filter(([_, value]) => value !== ''),
  ) as Record<string, string>

  let response: Response
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    })
  } catch (networkError: unknown) {
    const isTimeout = networkError instanceof DOMException && networkError.name === 'AbortError'
    const message = isTimeout
      ? 'Permintaan melebihi batas waktu'
      : 'Tidak dapat terhubung ke server API. Pastikan server API sedang berjalan.'
    throw new ApiError(0, message)
  } finally {
    clearTimeout(timeoutId)
  }

  const isAuthSessionEndpoint =
    endpoint === '/auth/login' ||
    endpoint === '/auth/refresh' ||
    endpoint === '/auth/me' ||
    endpoint === '/auth/logout' ||
    endpoint.startsWith('/auth/login?')

  const isPublicApiEndpoint =
    endpoint.startsWith('/tte/public/') || endpoint.startsWith('/sop/public/')

  if (response.status === 401 && !isAuthSessionEndpoint && !isPublicApiEndpoint) {
    if (retryCount === 0) {
      const refreshed = await waitForRefresh()
      if (refreshed) {
        return request<T>(endpoint, options, retryCount + 1)
      }
    }
    const { handleUnauthorizedSession } = await import('@/stores/authStore')
    handleUnauthorizedSession()
    throw new ApiError(401, 'Sesi berakhir. Silakan login kembali.')
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Request failed' }))
    const { message, errors, code } = extractErrors(errorBody)
    throw new ApiError(response.status, message, code, errors)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export const apiClient = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) => {
    const isFormData = body instanceof FormData
    const requestOptions: RequestInit = {
      method: 'POST',
      body: isFormData ? (body as FormData) : JSON.stringify(body),
    }

    if (isFormData) {
      requestOptions.headers = {
        'Content-Type': '',
      }
    }
    return request<T>(endpoint, requestOptions)
  },
  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = void>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
}
