import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  applyFlowchartPelaksanaFallbackBounds,
  measureFlowchartPelaksanaBounds,
} from '../SOPDiagramFlowchart'

function mockContainer(rect: { width: number; height: number }, hasImplCells: boolean): HTMLElement {
  const container = document.createElement('div')
  container.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: rect.width,
      bottom: rect.height,
      width: rect.width,
      height: rect.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect
  if (hasImplCells) {
    const cell = document.createElement('td')
    cell.setAttribute('data-implementer-id', 'impl-1')
    cell.getBoundingClientRect = () =>
      ({
        left: 40,
        top: 20,
        right: 120,
        bottom: 80,
        width: 80,
        height: 60,
        x: 40,
        y: 20,
        toJSON: () => ({}),
      }) as DOMRect
    container.appendChild(cell)
  }
  return container
}

describe('measureFlowchartPelaksanaBounds', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should_return_non_empty_sig_when_impl_cells_exist', () => {
    const container = mockContainer({ width: 400, height: 300 }, true)
    container.id = 'main-sop-area-0'
    document.body.appendChild(container)
    const boundsStore: Record<number, { left: number; top: number; right: number; bottom: number }> = {}
    const actual = measureFlowchartPelaksanaBounds(1, boundsStore)
    expect(actual.domReady).toBe(true)
    expect(actual.sig).toContain('0:')
    expect(boundsStore[0]?.right).toBeGreaterThan(boundsStore[0]?.left ?? 0)
  })

  it('should_apply_fallback_bounds_when_container_exists_without_impl_cells', () => {
    const container = mockContainer({ width: 500, height: 400 }, false)
    container.id = 'main-sop-area-0'
    document.body.appendChild(container)
    const boundsStore: Record<number, { left: number; top: number; right: number; bottom: number }> = {}
    const actualSig = applyFlowchartPelaksanaFallbackBounds(1, boundsStore)
    expect(actualSig).toContain('0:')
    expect(boundsStore[0]?.right).toBe(492)
    expect(boundsStore[0]?.bottom).toBe(392)
  })

  it('should_measure_the_requested_namespaced_instance_when_multiple_diagrams_exist', () => {
    const visibleContainer = mockContainer({ width: 500, height: 400 }, false)
    visibleContainer.id = 'main-sop-area-0'
    document.body.appendChild(visibleContainer)

    const exportContainer = mockContainer({ width: 400, height: 300 }, true)
    exportContainer.id = 'flowchart-export-main-sop-area-0'
    document.body.appendChild(exportContainer)

    const boundsStore: Record<number, { left: number; top: number; right: number; bottom: number }> = {}
    const actual = measureFlowchartPelaksanaBounds(
      1,
      boundsStore,
      (pageIndex) => `flowchart-export-main-sop-area-${pageIndex}`,
    )

    expect(actual.domReady).toBe(true)
    expect(boundsStore[0]).toEqual({
      left: 48,
      top: 24,
      right: 112,
      bottom: 88,
    })
  })
})
