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

const firstResponse = {
  success: true as const,
  message: 'ok',
  data: {
    reviewedDetailSopId: 'detail-1',
    reviewedVersion: 1,
    result: {
      status: 'CUKUP_BAIK' as const,
      summary: 'Struktur dasar sudah cukup baik tetapi tetap perlu review manusia.',
      findings: [
        {
          severity: 'WARNING' as const,
          category: 'CLARITY' as const,
          location: { kind: 'STEP' as const, stepOrder: 2 },
          title: 'Perjelas langkah verifikasi',
          explanation: 'Uraian langkah verifikasi masih dapat ditafsirkan berbeda oleh pelaksana.',
          recommendation: 'Gunakan kata kerja dan kondisi verifikasi yang lebih spesifik.',
        },
      ],
    },
  },
}

const secondResponse = {
  ...firstResponse,
  data: {
    ...firstResponse.data,
    result: {
      status: 'SIAP_DIREVIEW' as const,
      summary: 'Perbaikan sudah membuat alur lebih jelas untuk review manusia berikutnya.',
      findings: [],
    },
  },
}

const availabilityMock = vi.mocked(workspaceSopApi.aiReviewAvailability)
const reviewMock = vi.mocked(workspaceSopApi.reviewAiSop)

function renderReviewHook(options?: {
  detailSopId?: string
  isReadOnly?: boolean
  flushAllAutosave?: () => Promise<boolean>
  contentFingerprint?: string
}) {
  const flushAllAutosave = options?.flushAllAutosave ?? vi.fn().mockResolvedValue(true)
  const initialProps = {
    detailSopId: options?.detailSopId ?? 'detail-1',
    isReadOnly: options?.isReadOnly ?? false,
    flushAllAutosave,
    contentFingerprint: options?.contentFingerprint ?? 'fingerprint-a',
  }
  return {
    flushAllAutosave,
    ...renderHook(
      (props: typeof initialProps) => useAiSopQualityReview(props),
      { initialProps },
    ),
  }
}

describe('useAiSopQualityReview', () => {
  beforeEach(() => {
    availabilityMock.mockResolvedValue({
      success: true,
      message: 'ok',
      data: { enabled: true },
    })
    reviewMock.mockResolvedValue(firstResponse)
  })

  it('memuat availability dan menjalankan review hanya setelah autosave berhasil', async () => {
    const { result, flushAllAutosave } = renderReviewHook()
    await waitFor(() => expect(result.current.isAvailable).toBe(true))

    await act(async () => {
      await result.current.runReview()
    })

    expect(flushAllAutosave).toHaveBeenCalledTimes(1)
    expect(reviewMock).toHaveBeenCalledWith('detail-1')
    expect(result.current.review?.result.summary).toContain('review manusia')
    expect(result.current.error).toBeNull()
  })

  it('tidak memanggil review API jika autosave gagal', async () => {
    const flushAllAutosave = vi.fn().mockResolvedValue(false)
    const { result } = renderReviewHook({ flushAllAutosave })
    await waitFor(() => expect(result.current.isAvailable).toBe(true))

    await act(async () => {
      await result.current.runReview()
    })

    expect(reviewMock).not.toHaveBeenCalled()
    expect(result.current.error?.message).toMatch(/simpan/i)
  })

  it('tidak menjalankan review saat provider disabled atau SOP read-only', async () => {
    availabilityMock.mockResolvedValueOnce({
      success: true,
      message: 'ok',
      data: { enabled: false },
    })
    const disabled = renderReviewHook()
    await waitFor(() => expect(disabled.result.current.isAvailabilityLoading).toBe(false))
    await act(async () => {
      await disabled.result.current.runReview()
    })
    expect(disabled.flushAllAutosave).not.toHaveBeenCalled()
    expect(reviewMock).not.toHaveBeenCalled()

    availabilityMock.mockResolvedValueOnce({
      success: true,
      message: 'ok',
      data: { enabled: true },
    })
    const readOnly = renderReviewHook({ isReadOnly: true })
    await waitFor(() => expect(readOnly.result.current.isAvailable).toBe(true))
    await act(async () => {
      await readOnly.result.current.runReview()
    })
    expect(readOnly.flushAllAutosave).not.toHaveBeenCalled()
    expect(reviewMock).not.toHaveBeenCalled()
  })

  it('membersihkan review lama ketika fingerprint konten berubah', async () => {
    const hook = renderReviewHook()
    await waitFor(() => expect(hook.result.current.isAvailable).toBe(true))
    await act(async () => {
      await hook.result.current.runReview()
    })
    expect(hook.result.current.review).not.toBeNull()

    hook.rerender({
      detailSopId: 'detail-1',
      isReadOnly: false,
      flushAllAutosave: hook.flushAllAutosave,
      contentFingerprint: 'fingerprint-b',
    })

    await waitFor(() => expect(hook.result.current.review).toBeNull())
  })

  it('rerun mengganti hasil transient sebelumnya', async () => {
    reviewMock.mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(secondResponse)
    const { result } = renderReviewHook()
    await waitFor(() => expect(result.current.isAvailable).toBe(true))

    await act(async () => {
      await result.current.runReview()
    })
    expect(result.current.review?.result.status).toBe('CUKUP_BAIK')

    await act(async () => {
      await result.current.runReview()
    })
    expect(result.current.review?.result.status).toBe('SIAP_DIREVIEW')
    expect(result.current.review?.result.findings).toHaveLength(0)
  })
})
