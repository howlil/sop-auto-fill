import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  downloadSopPdf,
  printSopPdfDocument,
} from '../print-sop-pdf'
import {
  canCetakBeritaAcaraPengajuan,
  canCetakSopArsipPengajuan,
  PRINT_DELAY_MS,
  printSopArsipFromPreviewProps,
  scheduleSopDocumentPrint,
  triggerSopPrint,
} from '../pengajuan-print'

vi.mock('../print-sop-pdf', () => ({
  downloadSopPdf: vi.fn(() => Promise.resolve({ diagramExportFailed: false })),
  printSopPdfDocument: vi.fn(() => Promise.resolve({ diagramExportFailed: false })),
}))

const sampleSopPrintProps = {
  name: 'SOP Pengujian',
  number: '001/SOP',
}

describe('canCetakBeritaAcaraPengajuan', () => {
  it('mengizinkan cetak BA setelah kedua PJ menandatangani', () => {
    expect(canCetakBeritaAcaraPengajuan('DITANDATANGANI_PJ_PENYUSUN')).toBe(true)
    expect(canCetakBeritaAcaraPengajuan('SELESAI')).toBe(true)
    expect(canCetakBeritaAcaraPengajuan('DITANDATANGANI_PJ_EVALUATOR')).toBe(false)
    expect(canCetakBeritaAcaraPengajuan(undefined)).toBe(false)
  })
})

describe('canCetakSopArsipPengajuan', () => {
  it('mengizinkan cetak SOP arsip hanya saat status SELESAI', () => {
    expect(canCetakSopArsipPengajuan('SELESAI')).toBe(true)
    expect(canCetakSopArsipPengajuan('DITANDATANGANI_PJ_PENYUSUN')).toBe(false)
    expect(canCetakSopArsipPengajuan(undefined)).toBe(false)
  })
})


describe('triggerSopPrint', () => {
  beforeEach(() => {
    vi.mocked(printSopPdfDocument).mockClear()
  })

  it('memanggil printSopPdfDocument', async () => {
    triggerSopPrint(sampleSopPrintProps)
    await vi.waitFor(() => expect(printSopPdfDocument).toHaveBeenCalledOnce())
  })
})

describe('printSopArsipFromPreviewProps', () => {
  beforeEach(() => {
    vi.mocked(printSopPdfDocument).mockClear()
  })

  it('selalu memakai format PDF arsip SOP global', async () => {
    await printSopArsipFromPreviewProps({
      name: 'SOP Pengujian',
      number: '001/SOP',
      metadata: {},
      prosedurRows: [],
      implementers: [],
    })
    expect(printSopPdfDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        includeHeader: true,
        printMode: 'header_steps_bpmn',
      }),
      expect.objectContaining({
        includeHeader: true,
        printMode: 'header_steps_bpmn',
      }),
    )
  })
})


describe('scheduleSopDocumentPrint', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window, 'print').mockImplementation(() => {})
    vi.mocked(printSopPdfDocument).mockClear()
    document.body.className = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.className = ''
  })

  it('menjadwalkan cetak SOP lewat generator PDF', async () => {
    const promise = scheduleSopDocumentPrint(sampleSopPrintProps)
    expect(printSopPdfDocument).not.toHaveBeenCalled()
    vi.advanceTimersByTime(PRINT_DELAY_MS)
    await promise
    expect(printSopPdfDocument).toHaveBeenCalledWith(sampleSopPrintProps, undefined)
    expect(window.print).not.toHaveBeenCalled()
  })
})

describe('downloadSopPdf export', () => {
  it('tersedia dari modul print-sop-pdf', () => {
    expect(downloadSopPdf).toBeTypeOf('function')
  })
})
