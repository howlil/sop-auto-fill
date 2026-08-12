import { resolveApiBaseUrl } from '@/config/env'

export function buildQueryString(params: Record<string, unknown> | undefined): string {
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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const REQUEST_TIMEOUT = 15000

function getHeaders(method = 'GET'): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!SAFE_METHODS.has(method.toUpperCase())) headers['X-CSRF-Token'] = '1'
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

function extractErrors(errorBody: ErrorResponseBody) {
  const errors = Array.isArray(errorBody.errors)
    ? errorBody.errors
    : Array.isArray(errorBody.error)
      ? errorBody.error
      : undefined
  return {
    message: errors
      ? errors.join('\n')
      : errorBody.message || `HTTP ${errorBody.statusCode || errorBody.status || 'unknown'}`,
    errors,
    code: errorBody.code,
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  const method = options.method ?? 'GET'

  try {
    const response = await fetch(`${resolveApiBaseUrl()}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...getHeaders(method),
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    })

    if (response.status === 204) return undefined as T

    const body = (await response.json().catch(() => ({}))) as T & ErrorResponseBody
    if (!response.ok) {
      const parsed = extractErrors(body)
      if (response.status === 401 && typeof window !== 'undefined' && !endpoint.startsWith('/auth/')) {
        window.localStorage.removeItem('auth-storage')
        if (!window.location.pathname.startsWith('/login')) {
          const next = encodeURIComponent(window.location.pathname + window.location.search)
          window.location.assign(`/login?redirect=${next}`)
        }
      }
      throw new ApiError(response.status, parsed.message, parsed.code, parsed.errors)
    }
    return body as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(408, 'Permintaan ke server melewati batas waktu')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function withBody(method: string, body?: unknown): RequestInit {
  return {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

export const apiClient = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, withBody('POST', body)),
  put: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, withBody('PUT', body)),
  patch: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, withBody('PATCH', body)),
  delete: <T>(endpoint: string) => request<T>(endpoint, withBody('DELETE')),
}
