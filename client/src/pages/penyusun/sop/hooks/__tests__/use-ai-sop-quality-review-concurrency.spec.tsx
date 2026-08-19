import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceSopApi } from '@/api/workspace-sops'
import { useAiSopQualityReview } from '@/pages/penyusun/sop/hooks/use-ai-sop-quality-review'

vi.mock('@/api/workspace-sops', () => ({
  workspaceSopApi: {
    aiReviewAvailability: vi.fn(),
    reviewAiSop: vi.fn(),
  },
}))

const availabilityMock = vi.mocked(workspaceSopApi.aiReviewAvailability)
const reviewMock = vi.mocked(workspaceSopApi.reviewAiSop)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('useAiSopQualityReview concurrency guard', () => {
  beforeEach(() => {
    availabilityMock.mockResolvedValue({
      success: true,
      message: 'ok',
      data: { enabled: true },
    })
  })

  it('tidak menampilkan response review yang menjadi stale karena user mengedit saat request berjalan', async () => {
    const pendingReview = deferred<Awaited<ReturnType<typeof workspaceSopApi.reviewAiSop>>>()
    reviewMock.mockReturnValueOnce(pendingReview.promise)
    const flushAllAutosave = vi.fn().mockResolvedValue(true)

    const initialProps = {
      detailSopId: 'detail-1',
      isReadOnly: false,
      flushAllAutosave,
      contentFingerprint: 'before-request',
    }
    const hook = renderHook(
      (props: typeof initialProps) => useAiSopQualityReview(props),
      { initialProps },
    )

    await waitFor(() => expect(hook.result.current.isAvailable).toBe(true))

    let runPromise!: Promise<void>
    act(() => {
      runPromise = hook.result.current.runReview()
    })
    await waitFor(() => expect(reviewMock).toHaveBeenCalledWith('detail-1'))

    hook.rerender({
      ...initialProps,
      contentFingerprint: 'edited-during-request',
    })

    pendingReview.resolve({
      success: true,
      message: 'ok',
      data: {
        reviewedDetailSopId: 'detail-1',
        reviewedVersion: 1,
        result: {
          status: 'CUKUP_BAIK',
          summary: 'Response ini berasal dari snapshot sebelum edit berlangsung.',
          findings: [],
        },
      },
    })

    await act(async () => {
      await runPromise
    })

    expect(hook.result.current.review).toBeNull()
    expect(hook.result.current.error?.message).toMatch(/berubah.*review/i)
  })
})
