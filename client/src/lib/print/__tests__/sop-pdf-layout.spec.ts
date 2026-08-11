import { describe, expect, it } from 'vitest'
import { resolvePrintSections } from '@/components/sop/sop-pdf-document.test-utils'
import { sopPreviewPropsToPdfDocumentProps } from '@/lib/print/sop-pdf-props.util'

describe('sopPreviewPropsToPdfDocumentProps', () => {
  it('mengatur cetak arsip tanpa header dan mode diagram', () => {
    const actual = sopPreviewPropsToPdfDocumentProps(
      {
        name: 'SOP A',
        number: '001',
        metadata: {},
        prosedurRows: [],
        implementers: [],
      },
      { includeHeader: false, printMode: 'diagrams_only' },
    )
    expect(actual.includeHeader).toBe(false)
    expect(actual.printMode).toBe('diagrams_only')
  })
})

describe('resolvePrintSections', () => {
  it('menampilkan header dan tabel langkah tanpa diagram', () => {
    const actual = resolvePrintSections({
      includeHeader: true,
      printMode: 'header_and_steps',
      diagramSnapshots: [
        {
          kind: 'flowchart',
          pageIndex: 0,
          dataUrl: 'data:image/png;base64,abc',
          width: 100,
          height: 80,
        },
      ],
    })
    expect(actual.showHeader).toBe(true)
    expect(actual.showSteps).toBe(true)
    expect(actual.showDiagrams).toBe(false)
  })

  it('menampilkan header dan snapshot kanvas untuk mode header_steps_bpmn', () => {
    const actual = resolvePrintSections({
      includeHeader: true,
      printMode: 'header_steps_bpmn',
      diagramSnapshots: [
        {
          kind: 'bpmn',
          pageIndex: 0,
          dataUrl: 'data:image/png;base64,abc',
          width: 100,
          height: 80,
        },
      ],
    })
    expect(actual.showHeader).toBe(true)
    expect(actual.showSteps).toBe(false)
    expect(actual.showDiagrams).toBe(true)
  })

  it('menyembunyikan header saat mode diagrams_only dengan snapshot', () => {
    const actual = resolvePrintSections({
      includeHeader: false,
      printMode: 'diagrams_only',
      diagramSnapshots: [
        {
          kind: 'flowchart',
          pageIndex: 0,
          dataUrl: 'data:image/png;base64,abc',
          width: 100,
          height: 80,
        },
      ],
    })
    expect(actual.showHeader).toBe(false)
    expect(actual.showSteps).toBe(false)
    expect(actual.showDiagrams).toBe(true)
  })

  it('fallback ke tabel langkah bila diagrams_only tanpa snapshot', () => {
    const actual = resolvePrintSections({
      includeHeader: false,
      printMode: 'diagrams_only',
      diagramSnapshots: [],
    })
    expect(actual.showHeader).toBe(false)
    expect(actual.showSteps).toBe(true)
    expect(actual.showDiagrams).toBe(false)
  })
})
