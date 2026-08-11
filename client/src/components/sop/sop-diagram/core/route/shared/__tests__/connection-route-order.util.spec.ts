import { describe, expect, it } from 'vitest'
import {
  estimateConnectionSpan,
  findConnectionIdsWithCrossings,
  sortConnectionsForRouting,
} from '../connection-route-order.util'

describe('connection-route-order.util', () => {
  it('should_estimate_larger_span_for_distant_steps', () => {
    const near = estimateConnectionSpan({ id: 'a', from: 'sop-step-1', to: 'sop-step-2' })
    const far = estimateConnectionSpan({ id: 'b', from: 'sop-step-1', to: 'sop-step-9' })
    expect(far).toBeGreaterThan(near)
  })

  it('should_sort_longer_connections_before_shorter', () => {
    const list = [
      { id: 'short', from: 'sop-step-1', to: 'sop-step-2' },
      { id: 'long', from: 'sop-step-1', to: 'sop-step-10' },
    ]
    const sorted = sortConnectionsForRouting(list, 0)
    expect(sorted[0]!.id).toBe('long')
  })

  it('should_detect_crossing_between_two_connections', () => {
    const map = new Map([
      ['a', [{ x1: 50, y1: 10, x2: 150, y2: 10 }]],
      ['b', [{ x1: 100, y1: 0, x2: 100, y2: 50 }]],
    ])
    const violators = findConnectionIdsWithCrossings(map)
    expect(violators).toContain('a')
    expect(violators).toContain('b')
  })

  it('should_prioritize_violator_ids_on_reconcile_pass', () => {
    const list = [
      { id: 'a', from: 'sop-step-1', to: 'sop-step-2' },
      { id: 'b', from: 'sop-step-2', to: 'sop-step-3' },
    ]
    const sorted = sortConnectionsForRouting(list, 0, {
      priorityIds: new Set(['b']),
      reconcilePass: 1,
    })
    expect(sorted[0]!.id).toBe('b')
  })

  it('should_route_violators_last_when_reconcile_needs_stable_occupied_segments', () => {
    const list = [
      { id: 'a', from: 'sop-step-1', to: 'sop-step-2' },
      { id: 'b', from: 'sop-step-2', to: 'sop-step-3' },
    ]
    const sorted = sortConnectionsForRouting(list, 0, {
      priorityIds: new Set(['b']),
      reconcilePass: 1,
      priorityRoutesLast: true,
    })
    expect(sorted[sorted.length - 1]!.id).toBe('b')
  })
})
