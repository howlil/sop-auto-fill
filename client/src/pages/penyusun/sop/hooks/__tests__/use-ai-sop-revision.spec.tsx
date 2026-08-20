import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceSopApi, type SopQualityFinding } from '@/api/workspace-sops'
import { useAiSopRevision } from '@/pages/penyusun/sop/hooks/use-ai-sop-revision'

vi.mock('@/api/workspace-sops', () => ({
  workspaceSopApi: {
    aiRevisionAvailability: vi.fn(),
    suggestAiRevision: vi.fn(),
  },
}))

const finding: SopQualityFinding = {
  severity: 'WARNING', category: 'INPUT_OUTPUT', location: { kind: 'STEP', stepOrder: 2 },
  title: 'Keluaran terlalu umum',
  explanation: 'Keluaran belum menjelaskan hasil verifikasi secara spesifik.',
  recommendation: 'Perjelas keluaran langkah ini.',
}
const response = {
  success: true as const, message: 'ok', data: {
    sourceDetailSopId: 'detail-1', sourceVersion: 1,
    suggestion: { target: { kind: 'STEP' as const, stepOrder: 2, field: 'KELUARAN' as const }, before: 'Hasil', after: 'Berita acara hasil verifikasi', rationale: 'Lebih spesifik.' },
  },
}
const availabilityMock = vi.mocked(workspaceSopApi.aiRevisionAvailability)
const suggestMock = vi.mocked(workspaceSopApi.suggestAiRevision)

function renderRevision(options: Partial<{detailSopId:string;isReadOnly:boolean;flushAllAutosave:()=>Promise<boolean>;contentFingerprint:string;reviewFingerprint:string|null}> = {}) {
  const flushAllAutosave = options.flushAllAutosave ?? vi.fn().mockResolvedValue(true)
  const initialProps = { detailSopId:'detail-1', isReadOnly:false, flushAllAutosave, contentFingerprint:'content-a', reviewFingerprint:'review-a', ...options }
  return { flushAllAutosave, ...renderHook((props: typeof initialProps) => useAiSopRevision(props), { initialProps }) }
}

describe('useAiSopRevision', () => {
  beforeEach(() => {
    availabilityMock.mockResolvedValue({ success:true, message:'ok', data:{enabled:true} })
    suggestMock.mockResolvedValue(response)
  })

  it('requests a suggestion only after autosave succeeds', async () => {
    const hook = renderRevision()
    await waitFor(() => expect(hook.result.current.isAvailable).toBe(true))
    await act(async () => { await hook.result.current.suggest(finding) })
    expect(hook.flushAllAutosave).toHaveBeenCalledOnce()
    expect(suggestMock).toHaveBeenCalledWith('detail-1', finding)
    expect(hook.result.current.proposal?.suggestion.after).toContain('Berita acara')
    expect(hook.result.current.selectedFinding).toEqual(finding)
  })

  it('does not call API when save fails, provider disabled, or SOP is read-only', async () => {
    const failed = renderRevision({ flushAllAutosave: vi.fn().mockResolvedValue(false) })
    await waitFor(() => expect(failed.result.current.isAvailable).toBe(true))
    await act(async () => { await failed.result.current.suggest(finding) })
    expect(suggestMock).not.toHaveBeenCalled()
    expect(failed.result.current.error?.message).toMatch(/simpan/i)

    suggestMock.mockClear(); availabilityMock.mockResolvedValueOnce({ success:true,message:'ok',data:{enabled:false} })
    const disabled = renderRevision()
    await waitFor(() => expect(disabled.result.current.isAvailabilityLoading).toBe(false))
    await act(async () => { await disabled.result.current.suggest(finding) })
    expect(suggestMock).not.toHaveBeenCalled()

    availabilityMock.mockResolvedValueOnce({ success:true,message:'ok',data:{enabled:true} })
    const readOnly = renderRevision({ isReadOnly:true })
    await waitFor(() => expect(readOnly.result.current.isAvailable).toBe(true))
    await act(async () => { await readOnly.result.current.suggest(finding) })
    expect(suggestMock).not.toHaveBeenCalled()
  })

  it('keeps failures transient and cancel/clear never mutate editor state', async () => {
    suggestMock.mockRejectedValueOnce(new Error('provider unavailable'))
    const hook = renderRevision()
    await waitFor(() => expect(hook.result.current.isAvailable).toBe(true))
    await act(async () => { await hook.result.current.suggest(finding) })
    expect(hook.result.current.error?.message).toContain('provider unavailable')
    expect(hook.result.current.proposal).toBeNull()

    suggestMock.mockResolvedValueOnce(response)
    await act(async () => { await hook.result.current.suggest(finding) })
    act(() => hook.result.current.cancel())
    expect(hook.result.current.proposal).toBeNull()
    expect(hook.result.current.selectedFinding).toBeNull()
  })

  it('clears proposal when content or review fingerprint changes', async () => {
    const hook = renderRevision()
    await waitFor(() => expect(hook.result.current.isAvailable).toBe(true))
    await act(async () => { await hook.result.current.suggest(finding) })
    hook.rerender({ detailSopId:'detail-1', isReadOnly:false, flushAllAutosave:hook.flushAllAutosave, contentFingerprint:'content-b', reviewFingerprint:'review-a' })
    await waitFor(() => expect(hook.result.current.proposal).toBeNull())
    await act(async () => { await hook.result.current.suggest(finding) })
    hook.rerender({ detailSopId:'detail-1', isReadOnly:false, flushAllAutosave:hook.flushAllAutosave, contentFingerprint:'content-b', reviewFingerprint:'review-b' })
    await waitFor(() => expect(hook.result.current.proposal).toBeNull())
  })
})
