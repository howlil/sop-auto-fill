import {
  buildFlowchartTableColumnPercents,
  centerXToLeftPx,
  computeColumnCenterX,
  computeOpcStackTopPx,
  computePelaksanaColumnCenterPercent,
  layoutOpcEndpointPlacements,
  layoutOpcPlacements,
  OPC_CONNECTOR_WIDTH_PX,
  resolveOpcImplementerId,
} from '../flowchart-opc-placement.util'
import type { OpcPair } from '../flowchartPagination'

function opc(overrides: Partial<OpcPair> & Pick<OpcPair, 'fromSeq' | 'toSeq'>): OpcPair {
  return {
    letter: 'A',
    fromPage: 0,
    toPage: 1,
    fromImplId: 'impl-a',
    toImplId: 'impl-b',
    originalConn: { id: 'c1', from: 'sop-step-1', to: 'sop-step-2' },
    ...overrides,
  }
}

describe('flowchart-opc-placement', () => {
  const tableColumns = buildFlowchartTableColumnPercents(25, 17.5)
  const implementers = [{ id: 'impl-a' }, { id: 'impl-b' }, { id: 'impl-c' }]

  it('should_resolve_implementer_for_in_and_out_variants', () => {
    const pair = opc({ fromImplId: 'impl-a', toImplId: 'impl-b', fromSeq: 1, toSeq: 9 })
    expect(resolveOpcImplementerId(pair, 'in')).toBe('impl-b')
    expect(resolveOpcImplementerId(pair, 'out')).toBe('impl-a')
  })

  it('should_compute_column_center_percent_from_table_layout', () => {
    expect(computePelaksanaColumnCenterPercent(0, tableColumns)).toBe(5 + 25 + 17.5 * 0.5)
    expect(computePelaksanaColumnCenterPercent(2, tableColumns)).toBe(5 + 25 + 17.5 * 2.5)
  })

  it('should_center_connector_in_measured_column_bounds', () => {
    const bounds = { left: 200, top: 10, right: 320, bottom: 400 }
    expect(computeColumnCenterX(bounds)).toBe(260)
    expect(centerXToLeftPx(260)).toBe(260 - OPC_CONNECTOR_WIDTH_PX / 2)
  })

  it('should_place_opc_at_dom_center_x_when_column_bounds_exist', () => {
    const placements = layoutOpcPlacements([opc({ fromSeq: 3, toSeq: 10, toImplId: 'impl-b' })], 'in', {
      implementers,
      columnBounds: {
        'impl-b': { left: 180, top: 0, right: 300, bottom: 500 },
      },
      tableColumns,
    })
    expect(placements).toHaveLength(1)
    expect(placements[0]!.centerXPx).toBe(240)
    expect(placements[0]!.centerPercent).toBe(computePelaksanaColumnCenterPercent(1, tableColumns))
  })

  it('should_stack_multiple_opc_in_same_column_vertically', () => {
    const placements = layoutOpcPlacements(
      [
        opc({ fromSeq: 1, toSeq: 8, fromImplId: 'impl-a', toImplId: 'impl-a' }),
        opc({ fromSeq: 2, toSeq: 9, fromImplId: 'impl-a', toImplId: 'impl-a' }),
      ],
      'out',
      { implementers, tableColumns },
    )
    expect(placements).toHaveLength(2)
    expect(placements[0]!.centerPercent).toBe(placements[1]!.centerPercent)
    expect(placements[1]!.stackIndex).toBe(1)
    expect(computeOpcStackTopPx(1)).toBeGreaterThan(0)
  })

  it('should_keep_mixed_endpoint_variants_in_one_visual_row', () => {
    const forwardIn = opc({
      fromSeq: 1,
      toSeq: 8,
      opcInId: 'forward-in',
      toImplId: 'impl-b',
    })
    const loopbackOut = opc({
      fromSeq: 9,
      toSeq: 2,
      opcOutId: 'loopback-out',
      fromImplId: 'impl-a',
    })
    const placements = layoutOpcEndpointPlacements(
      [
        { opc: forwardIn, variant: 'in' },
        { opc: loopbackOut, variant: 'out' },
      ],
      { implementers, tableColumns },
    )

    expect(placements.map((placement) => placement.elementId)).toEqual([
      'loopback-out',
      'forward-in',
    ])
  })
})
