import { describe, expect, it } from 'vitest'
import { applyUsedSidePayload } from '../used-side-usage.util'
import type { UsedSides } from '../connector-side.types'

describe('used-side-usage.util', () => {
  it('should_return_same_reference_for_identical_side_usage', () => {
    const prev: UsedSides = {
      a: { out: { bottom: ['conn-1'] } },
      b: { in: { top: ['conn-1'] } },
    }
    const next = applyUsedSidePayload(prev, {
      connectionId: 'conn-1',
      from: 'a',
      to: 'b',
      sSide: 'bottom',
      eSide: 'top',
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 10, y: 10 },
      bendPoints: [],
    })
    expect(next).toBe(prev)
  })

  it('should_move_connection_to_new_sides_without_leaving_stale_usage', () => {
    const prev: UsedSides = {
      a: { out: { bottom: ['conn-1'] } },
      b: { in: { top: ['conn-1'] } },
    }
    const next = applyUsedSidePayload(prev, {
      connectionId: 'conn-1',
      from: 'a',
      to: 'b',
      sSide: 'right',
      eSide: 'left',
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 10, y: 10 },
      bendPoints: [],
    })
    expect(next).not.toBe(prev)
    expect(next.a?.out?.bottom).toBeUndefined()
    expect(next.a?.out?.right).toEqual(['conn-1'])
    expect(next.b?.in?.top).toBeUndefined()
    expect(next.b?.in?.left).toEqual(['conn-1'])
  })
})
