import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceSopApi, type SopQualityFinding } from '@/api/workspace-sops'
import { useAiSopRevision } from '@/pages/penyusun/sop/hooks/use-ai-sop-revision'

vi.mock('@/api/workspace-sops', () => ({ workspaceSopApi: { aiRevisionAvailability: vi.fn(), suggestAiRevision: vi.fn() } }))

const finding: SopQualityFinding = { severity:'WARNING', category:'CLARITY', location:{kind:'STEP',stepOrder:1}, title:'Perjelas kegiatan', explanation:'Kegiatan perlu dibuat lebih eksplisit dan tidak ambigu.', recommendation:'Gunakan kata kerja yang lebih spesifik.' }
const makeResponse = (after:string) => ({ success:true as const,message:'ok',data:{ sourceDetailSopId:'detail-1',sourceVersion:1,suggestion:{target:{kind:'STEP' as const,stepOrder:1,field:'KEGIATAN' as const},before:'Proses',after,rationale:'Lebih jelas.'}}})
function deferred<T>() { let resolve!: (value:T)=>void; const promise=new Promise<T>((r)=>{resolve=r}); return {promise,resolve} }

const availabilityMock = vi.mocked(workspaceSopApi.aiRevisionAvailability)
const suggestMock = vi.mocked(workspaceSopApi.suggestAiRevision)

describe('useAiSopRevision concurrency', () => {
  beforeEach(() => availabilityMock.mockResolvedValue({success:true,message:'ok',data:{enabled:true}}))

  it.each([
    ['content', {contentFingerprint:'content-b'}],
    ['detail', {detailSopId:'detail-2'}],
    ['review', {reviewFingerprint:'review-b'}],
  ] as const)('discards response when %s changes in flight', async (_name, changed) => {
    const pending=deferred<ReturnType<typeof makeResponse>>(); suggestMock.mockReturnValueOnce(pending.promise)
    const flush=vi.fn().mockResolvedValue(true)
    const initial={detailSopId:'detail-1',isReadOnly:false,flushAllAutosave:flush,contentFingerprint:'content-a',reviewFingerprint:'review-a'}
    const hook=renderHook((props:typeof initial)=>useAiSopRevision(props),{initialProps:initial})
    await waitFor(()=>expect(hook.result.current.isAvailable).toBe(true))
    let request!:Promise<void>
    act(()=>{ request=hook.result.current.suggest(finding) })
    await waitFor(()=>expect(suggestMock).toHaveBeenCalledOnce())
    hook.rerender({...initial,...changed})
    pending.resolve(makeResponse('Usulan lama'))
    await act(async()=>{await request})
    expect(hook.result.current.proposal).toBeNull()
    expect(hook.result.current.error?.message).toMatch(/berubah|ulang|stale/i)
  })

  it('does not let an older request replace newer state', async () => {
    const first=deferred<ReturnType<typeof makeResponse>>(); const second=deferred<ReturnType<typeof makeResponse>>()
    suggestMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const flush=vi.fn().mockResolvedValue(true)
    const props={detailSopId:'detail-1',isReadOnly:false,flushAllAutosave:flush,contentFingerprint:'content-a',reviewFingerprint:'review-a'}
    const hook=renderHook((p:typeof props)=>useAiSopRevision(p),{initialProps:props})
    await waitFor(()=>expect(hook.result.current.isAvailable).toBe(true))
    let firstRequest!:Promise<void>; act(()=>{firstRequest=hook.result.current.suggest(finding)})
    await waitFor(()=>expect(suggestMock).toHaveBeenCalledTimes(1))
    act(()=>hook.result.current.clear())
    let secondRequest!:Promise<void>; act(()=>{secondRequest=hook.result.current.suggest(finding)})
    await waitFor(()=>expect(suggestMock).toHaveBeenCalledTimes(2))
    second.resolve(makeResponse('Usulan terbaru')); await act(async()=>{await secondRequest})
    first.resolve(makeResponse('Usulan lama')); await act(async()=>{await firstRequest})
    expect(hook.result.current.proposal?.data.suggestion.after).toBe('Usulan terbaru')
  })
})
