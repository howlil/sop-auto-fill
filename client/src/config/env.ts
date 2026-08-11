/** API dev: Vite → backend di localhost. */
const API_BASE_URL_DEVELOPMENT = 'http://localhost:3000/api/v1'

/** API produksi: path relatif; Nginx frontend mem-proxy `/api` → backend (client/nginx.conf). */
const API_BASE_URL_PRODUCTION = '/api/v1'

export const APP_DISPLAY_NAME = 'SOPFlow'
export const APP_VERSION = '1.0.0'

export function resolveApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  return import.meta.env.DEV ? API_BASE_URL_DEVELOPMENT : API_BASE_URL_PRODUCTION
}
