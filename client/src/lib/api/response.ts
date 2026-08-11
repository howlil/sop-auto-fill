import type { ApiSuccessResponse } from '@/types/dto/auth.dto'

export async function unwrapApiData<T>(
  promise: Promise<ApiSuccessResponse<T>>,
): Promise<T> {
  const envelope = await promise
  return envelope.data as T
}

export async function unwrapApiVoid(
  promise: Promise<ApiSuccessResponse<unknown>>,
): Promise<void> {
  await unwrapApiData(promise)
}

export function readApiData<T>(value: unknown): T | undefined {
  if (value !== null && typeof value === 'object' && 'data' in value) {
    return (value as ApiSuccessResponse<T>).data
  }
  return undefined
}
