import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  useSopHeaderAutosave,
  type SopHeaderSnapshot,
} from '@/pages/penyusun/sop/hooks/use-sop-header-autosave'
import {
  useSopProsedurAutosave,
  type SopProsedurSnapshot,
} from '@/pages/penyusun/sop/hooks/use-sop-prosedur-autosave'

const headerInitial: SopHeaderSnapshot = {
  judul: 'SOP Lama',
  nomorSOP: '001',
  namaLembaga: 'Unit',
  peringatan: [],
  dasarHukumPeraturanIds: [],
  sopTerkaitDetailIds: [],
  kualifikasiPelaksanaan: [],
  peralatanPerlengkapan: [],
  pencatatanPendataan: [],
}

const prosedurInitial: SopProsedurSnapshot = { pelaksana: [], langkah: [] }
const prosedurChanged: SopProsedurSnapshot = {
  pelaksana: [{ pelaksanaId: 'pel-1' }],
  langkah: [],
}

describe('autosave flush result contract', () => {
  it('header flush mengembalikan true saat save berhasil', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: SopHeaderSnapshot }) =>
        useSopHeaderAutosave({
          detailSopId: 'detail-1',
          snapshot,
          save,
          debounceMs: 60_000,
        }),
      { initialProps: { snapshot: headerInitial } },
    )

    rerender({ snapshot: { ...headerInitial, judul: 'SOP Baru' } })
    let succeeded: boolean | undefined
    await act(async () => {
      succeeded = await result.current.flush()
    })

    expect(succeeded).toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('header flush mengembalikan false saat save gagal dan mempertahankan status error', async () => {
    const save = vi.fn().mockRejectedValue(new Error('save gagal'))
    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: SopHeaderSnapshot }) =>
        useSopHeaderAutosave({
          detailSopId: 'detail-1',
          snapshot,
          save,
          debounceMs: 60_000,
        }),
      { initialProps: { snapshot: headerInitial } },
    )

    rerender({ snapshot: { ...headerInitial, judul: 'SOP Baru' } })
    let succeeded: boolean | undefined
    await act(async () => {
      succeeded = await result.current.flush()
    })

    expect(succeeded).toBe(false)
    expect(result.current.status).toBe('error')
    expect(result.current.lastError?.message).toBe('save gagal')
  })

  it('prosedur flush mengembalikan true saat save berhasil', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: SopProsedurSnapshot }) =>
        useSopProsedurAutosave({
          detailSopId: 'detail-1',
          snapshot,
          save,
          debounceMs: 60_000,
        }),
      { initialProps: { snapshot: prosedurInitial } },
    )

    rerender({ snapshot: prosedurChanged })
    let succeeded: boolean | undefined
    await act(async () => {
      succeeded = await result.current.flush()
    })

    expect(succeeded).toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('prosedur flush mengembalikan false saat save gagal dan mempertahankan status error', async () => {
    const save = vi.fn().mockRejectedValue(new Error('prosedur gagal'))
    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: SopProsedurSnapshot }) =>
        useSopProsedurAutosave({
          detailSopId: 'detail-1',
          snapshot,
          save,
          debounceMs: 60_000,
        }),
      { initialProps: { snapshot: prosedurInitial } },
    )

    rerender({ snapshot: prosedurChanged })
    let succeeded: boolean | undefined
    await act(async () => {
      succeeded = await result.current.flush()
    })

    expect(succeeded).toBe(false)
    expect(result.current.status).toBe('error')
    expect(result.current.lastError?.message).toBe('prosedur gagal')
  })
})
