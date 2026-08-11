import { describe, expect, it } from 'vitest'
import { bpmnLaneBoundaryTrackYs } from '../bpmn-lane-corridor.util'

describe('bpmnLaneBoundaryTrackYs', () => {
  it('uses inset rails when rendered swimlane rows touch each other', () => {
    const tracks = bpmnLaneBoundaryTrackYs(
      { index: 0, top: 0, height: 152 },
      { index: 1, top: 152, height: 152 },
    )

    expect(tracks).toEqual([136, 168])
    expect(tracks).not.toContain(152)
  })

  it('uses the middle of a real lane gap when one exists', () => {
    const tracks = bpmnLaneBoundaryTrackYs(
      { index: 0, top: 0, height: 120 },
      { index: 1, top: 140, height: 120 },
    )

    expect(tracks).toEqual([130])
  })
})
