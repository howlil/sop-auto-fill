/**
 * Query Client — configuration + initialization
 */

import { QueryClient } from '@tanstack/react-query'
import type { QueryClientConfig } from '@tanstack/react-query'

const DEFAULT_STALE_TIME = 1000 * 60 * 5 // 5 minutes

function getDefaultRetry(failureCount: number, error: Error): boolean {
  const status = 'status' in error ? (error as { status: number }).status : 0
  if (status >= 400 && status < 500) return false
  return failureCount < 2
}

const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME,
      retry: getDefaultRetry,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
}

export const queryClient = new QueryClient(queryClientConfig)
