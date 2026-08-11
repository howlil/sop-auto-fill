import { describe, expect, it } from 'vitest'
import { translateBpmnLaneLayoutToDom } from '../bpmnRouter'

describe('translateBpmnLaneLayoutToDom', () => {
  it('should_shift_column_and_lane_coordinates_by_origin', () => {
    const layout = {
      lanes: [{ index: 0, top: 0, height: 160 }],
      columnStartXs: [72, 300],
      columnWidths: [120, 120],
      originX: 110,
      originY: 24,
    }
    const translated = translateBpmnLaneLayoutToDom(layout)
    expect(translated.columnStartXs).toEqual([182, 410])
    expect(translated.lanes[0]?.top).toBe(24)
  })

  it('should_return_same_layout_when_origin_is_zero', () => {
    const layout = {
      lanes: [{ index: 0, top: 0, height: 160 }],
      columnStartXs: [72],
      columnWidths: [120],
    }
    expect(translateBpmnLaneLayoutToDom(layout)).toBe(layout)
  })
})
