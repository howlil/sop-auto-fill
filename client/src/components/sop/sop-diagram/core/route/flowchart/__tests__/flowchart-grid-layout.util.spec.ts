import { describe, expect, it } from 'vitest'
import {
  findFlowchartRowPipeY,
  measureFlowchartGridLayout,
  nudgePathOffGridLines,
  pathRunsAlongFlowchartGrid,
  snapHorizontalSegmentsToRowGutters,
  type FlowchartGridLayout,
} from '../flowchart-grid-layout.util'

function layoutFixture(): FlowchartGridLayout {
  return {
    horizontalLines: [0, 80, 160, 240],
    verticalLines: [40, 120, 200],
    rowGutters: [120],
    minGridX: 40,
    maxGridX: 200,
    minGridY: 0,
    maxGridY: 240,
  }
}

describe('flowchart-grid-layout.util', () => {
  it('should_detect_horizontal_segment_on_row_border', () => {
    const layout = layoutFixture()
    const path = [
      { x: 50, y: 80 },
      { x: 180, y: 80 },
    ]
    expect(pathRunsAlongFlowchartGrid(path, layout, 8)).toBe(true)
  })

  it('should_not_flag_segment_in_row_gutter', () => {
    const layout = layoutFixture()
    const path = [
      { x: 50, y: 120 },
      { x: 180, y: 120 },
    ]
    expect(pathRunsAlongFlowchartGrid(path, layout, 8)).toBe(false)
  })

  it('should_return_pipe_y_between_rows', () => {
    const layout = layoutFixture()
    expect(findFlowchartRowPipeY(layout, 0, 1)).toBe(120)
  })

  it('should_nudge_horizontal_segment_off_border', () => {
    const layout = layoutFixture()
    const path = [
      { x: 50, y: 80 },
      { x: 180, y: 80 },
    ]
    const nudged = nudgePathOffGridLines(path, layout, 8)
    expect(pathRunsAlongFlowchartGrid(nudged, layout, 6)).toBe(false)
  })

  it('should_snap_long_horizontal_span_to_row_gutter', () => {
    const layout = layoutFixture()
    const path = [
      { x: 50, y: 82 },
      { x: 190, y: 82 },
    ]
    const snapped = snapHorizontalSegmentsToRowGutters(path, layout)
    expect(snapped[0]!.y).toBe(120)
    expect(snapped[1]!.y).toBe(120)
  })

  it('should_measure_grid_from_impl_cells', () => {
    const container = document.createElement('div')
    container.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 300,
        bottom: 200,
        width: 300,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    const tr1 = document.createElement('tr')
    const tr2 = document.createElement('tr')
    const table = document.createElement('table')
    const tbody = document.createElement('tbody')
    tbody.appendChild(tr1)
    tbody.appendChild(tr2)
    table.appendChild(tbody)
    container.appendChild(table)

    const makeCell = (tr: HTMLTableRowElement, top: number) => {
      const cell = document.createElement('td')
      cell.setAttribute('data-implementer-id', 'impl-1')
      cell.getBoundingClientRect = () =>
        ({
          left: 50,
          top,
          right: 150,
          bottom: top + 60,
          width: 100,
          height: 60,
          x: 50,
          y: top,
          toJSON: () => ({}),
        }) as DOMRect
      tr.appendChild(cell)
    }
    makeCell(tr1, 10)
    makeCell(tr2, 90)

    const layout = measureFlowchartGridLayout(container)
    expect(layout).not.toBeNull()
    expect(layout!.horizontalLines.length).toBeGreaterThanOrEqual(2)
    expect(layout!.rowGutters.length).toBe(1)
  })
})
