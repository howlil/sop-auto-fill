/** API dev: Vite → backend lokal. */
const API_BASE_URL_DEVELOPMENT = 'http://localhost:3000/api/v1'
const API_BASE_URL_PRODUCTION = '/api/v1'

export const APP_DISPLAY_NAME = 'SOPFlow'
export const APP_VERSION = '2.0.0'
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

export function resolveApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  return import.meta.env.DEV ? API_BASE_URL_DEVELOPMENT : API_BASE_URL_PRODUCTION
}
