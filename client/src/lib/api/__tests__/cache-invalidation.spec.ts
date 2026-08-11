import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/config/query-keys'
import {
  invalidateSopEvaluasiWorkflow,
  SOP_EVALUASI_WORKFLOW_REFRESH_OPTIONS,
} from '@/lib/api/cache-invalidation'

describe('invalidateSopEvaluasiWorkflow', () => {
  it('invalidates all workflow cache prefixes without refetch during autosave', async () => {
    const queryClient = new QueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined)

    await invalidateSopEvaluasiWorkflow(queryClient, 'none')

    expect(invalidateQueries.mock.calls.map(([filters]) => filters)).toEqual([
      { queryKey: queryKeys.sop, refetchType: 'none' },
      { queryKey: queryKeys.detailSop, refetchType: 'none' },
      { queryKey: queryKeys.evaluasi, refetchType: 'none' },
    ])
  })

  it('refreshes status-sensitive queries when a tab becomes active', () => {
    expect(SOP_EVALUASI_WORKFLOW_REFRESH_OPTIONS).toEqual({
      staleTime: 0,
      refetchOnWindowFocus: true,
    })
  })
})
