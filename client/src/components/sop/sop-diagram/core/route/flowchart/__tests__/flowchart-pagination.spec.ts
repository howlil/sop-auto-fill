import { describe, expect, it } from 'vitest'
import {
  getOpcElementId,
  getOpcShapesForPage,
  splitCrossPageConnections,
} from '../flowchartPagination'
import type { SOPStep } from '../../../sopDiagramTypes'

function step(seqNumber: number, implementerId: string): SOPStep {
  return {
    id_step: `row-${seqNumber}`,
    seq_number: seqNumber,
    name: `Langkah ${seqNumber}`,
    type: 'process',
    id_implementer: implementerId,
  }
}

describe('splitCrossPageConnections', () => {
  it('namespaces OPC ids for an isolated diagram instance', () => {
    const steps = [step(1, 'impl-a'), step(2, 'impl-b')]
    const result = splitCrossPageConnections(
      [
        {
          id: 'conn-1-to-2',
          from: 'flowchart-export-sop-step-1',
          to: 'flowchart-export-sop-step-2',
          fromImplementerId: 'impl-a',
          toImplementerId: 'impl-b',
        },
      ],
      steps,
      1,
      1,
      'flowchart-export-sop-step-',
      'flowchart-export-',
    )

    expect(result.pages[0]?.[0]?.to).toBe('flowchart-export-opc-out-step-1-to-step-2')
    expect(result.pages[1]?.[0]?.from).toBe('flowchart-export-opc-in-step-1-to-step-2')
    expect(result.pages[0]?.[0]?.toImplementerId).toBe('impl-a')
    expect(result.pages[1]?.[0]?.fromImplementerId).toBe('impl-b')
    expect(getOpcElementId(result.opcPairs[0]!, 'out')).toBe(
      'flowchart-export-opc-out-step-1-to-step-2',
    )
    expect(getOpcElementId(result.opcPairs[0]!, 'in')).toBe(
      'flowchart-export-opc-in-step-1-to-step-2',
    )
  })

  it('keeps semantic endpoint variants when a cross-page edge loops back', () => {
    const steps = [step(1, 'impl-a'), step(2, 'impl-b')]
    const result = splitCrossPageConnections(
      [
        {
          id: 'conn-2-no-1',
          from: 'sop-step-2',
          to: 'sop-step-1',
          label: 'Tidak',
        },
      ],
      steps,
      1,
      1,
    )

    expect(getOpcShapesForPage(1, result.opcPairs).top).toEqual([
      { opc: result.opcPairs[0], variant: 'out' },
    ])
    expect(getOpcShapesForPage(0, result.opcPairs).bottom).toEqual([
      { opc: result.opcPairs[0], variant: 'in' },
    ])
  })
})
