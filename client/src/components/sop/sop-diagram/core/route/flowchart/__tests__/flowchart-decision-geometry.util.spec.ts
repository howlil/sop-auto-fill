import {
  FLOWCHART_DECISION_VERTICES_VIEWBOX,
  pointOnFlowchartDecisionVertex,
} from '../flowchart-decision-geometry.util'

describe('flowchart-decision-geometry.util', () => {
  const rect = { left: 100, top: 50, width: 66, height: 66 }

  it('should_map_top_vertex_with_y_inset_from_bbox_top', () => {
    const pt = pointOnFlowchartDecisionVertex(rect, 'top')
    expect(pt.x).toBe(133)
    expect(pt.y).toBe(53)
  })

  it('should_map_right_vertex_with_x_inset_from_bbox_right', () => {
    const pt = pointOnFlowchartDecisionVertex(rect, 'right')
    expect(pt.x).toBe(163)
    expect(pt.y).toBe(83)
  })

  it('should_map_bottom_and_left_vertices_symmetrically', () => {
    const bottom = pointOnFlowchartDecisionVertex(rect, 'bottom')
    const left = pointOnFlowchartDecisionVertex(rect, 'left')
    expect(bottom.x).toBe(133)
    expect(bottom.y).toBe(113)
    expect(left.x).toBe(103)
    expect(left.y).toBe(83)
  })

  it('should_match_polygon_viewbox_coordinates', () => {
    expect(FLOWCHART_DECISION_VERTICES_VIEWBOX.top).toEqual({ x: 30, y: 1 })
    expect(FLOWCHART_DECISION_VERTICES_VIEWBOX.right).toEqual({ x: 59, y: 30 })
  })
})
