import { describe, expect, it } from 'vitest'
import {
  isOrthogonalPath,
  pathIntersectsRectangles,
} from '../../shared/orthogonalRouter'
import { routeBpmnOnChannelGraph } from '../global/bpmn-channel-pathfinder'

describe('routeBpmnOnChannelGraph', () => {
  it('finds an orthogonal corridor around an intermediate obstacle', () => {
    const obstacle = { left: 250, top: 60, width: 100, height: 100 }
    const path = routeBpmnOnChannelGraph({
      fromShape: { left: 80, top: 80, width: 100, height: 60 },
      toShape: { left: 480, top: 80, width: 100, height: 60 },
      fromSide: 'right',
      toSide: 'left',
      fromDistance: 0.5,
      toDistance: 0.5,
      layout: {
        lanes: [
          { index: 0, top: 40, height: 120 },
          { index: 1, top: 180, height: 120 },
        ],
        columnStartXs: [80, 280, 480],
        columnWidths: [120, 120, 120],
      },
      bounds: { left: 0, top: 0, width: 720, height: 340 },
      obstacles: [obstacle],
      occupied: [],
    })

    expect(path.length).toBeGreaterThanOrEqual(4)
    expect(isOrthogonalPath(path)).toBe(true)
    expect(pathIntersectsRectangles(path, [obstacle])).toBe(false)
  })
})
