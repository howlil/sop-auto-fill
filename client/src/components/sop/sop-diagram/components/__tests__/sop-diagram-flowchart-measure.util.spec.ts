import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { measureFlowchartLayoutWithColumns } from '../sop-diagram-flowchart-measure.util'
import type { ImplementerColumnBoundsMap } from '../../core/route/flowchart/flowchart-column-bounds.util'
import type { FlowchartGridLayout } from '../../core/route/flowchart/flowchart-grid-layout.util'

function rect(left: number, top: number, right: number, bottom: number): DOMRect {
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function appendRow(tbody: HTMLTableSectionElement, top: number): void {
  const tr = document.createElement('tr')
  const td = document.createElement('td')
  td.dataset.implementerId = 'impl-a'
  td.getBoundingClientRect = () => rect(60, top, 180, top + 60)
  tr.appendChild(td)
  tbody.appendChild(tr)
}

describe('measureFlowchartLayoutWithColumns', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should_include_row_gutters_in_the_layout_signature', () => {
    const container = document.createElement('div')
    container.id = 'main-sop-area-0'
    container.getBoundingClientRect = () => rect(0, 0, 400, 320)
    const table = document.createElement('table')
    const tbody = document.createElement('tbody')
    table.appendChild(tbody)
    container.appendChild(table)
    document.body.appendChild(container)

    appendRow(tbody, 20)
    appendRow(tbody, 120)

    const boundsStore: Record<number, { left: number; top: number; right: number; bottom: number }> = {}
    const columnStore: Record<number, ImplementerColumnBoundsMap> = {}
    const gridStore: Record<number, FlowchartGridLayout | null> = {}
    const before = measureFlowchartLayoutWithColumns(
      1,
      boundsStore,
      columnStore,
      undefined,
      gridStore,
    )

    tbody.innerHTML = ''
    appendRow(tbody, 20)
    appendRow(tbody, 160)
    const after = measureFlowchartLayoutWithColumns(
      1,
      boundsStore,
      columnStore,
      undefined,
      gridStore,
    )

    expect(before.sig).not.toBe(after.sig)
    expect(gridStore[0]?.rowGutters).toHaveLength(1)
  })

  it('should_remove_stale_geometry_when_the_page_count_shrinks', () => {
    const boundsStore = {
      0: { left: 0, top: 0, right: 100, bottom: 100 },
      1: { left: 0, top: 0, right: 100, bottom: 100 },
    }
    const columnStore: Record<number, ImplementerColumnBoundsMap> = {
      1: { stale: { left: 0, top: 0, right: 100, bottom: 100 } },
    }
    const gridStore: Record<number, FlowchartGridLayout | null> = {
      1: {
        horizontalLines: [0, 100],
        verticalLines: [0, 100],
        rowGutters: [],
        minGridX: 0,
        maxGridX: 100,
        minGridY: 0,
        maxGridY: 100,
      },
    }

    measureFlowchartLayoutWithColumns(1, boundsStore, columnStore, undefined, gridStore)

    expect(boundsStore[1]).toBeUndefined()
    expect(columnStore[1]).toBeUndefined()
    expect(gridStore[1]).toBeUndefined()
  })
})
