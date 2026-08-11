import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BPMN_GATEWAY_HALF_SIZE } from '../../../layout/bpmnDiagramMetrics'
import { Gateway } from '../BpmnBasicShapes'

describe('Gateway', () => {
  it('renders the decision caption below the diamond without expanding its measured group', () => {
    const { container } = render(
      <svg>
        <Gateway id="gateway-1" x={80} y={60} name="Dokumen lengkap?" />
      </svg>,
    )

    const measuredGateway = container.querySelector('#gateway-1')
    const caption = container.querySelector('text')
    const captionLines = Array.from(caption?.querySelectorAll('tspan') ?? []).map(
      (line) => line.textContent,
    )

    expect(measuredGateway?.querySelector('path')).not.toBeNull()
    expect(measuredGateway?.querySelector('text')).toBeNull()
    expect(captionLines).toEqual(['Dokumen', 'lengkap?'])
    expect(caption).toHaveAttribute('x', '80')
    expect(Number(caption?.getAttribute('y'))).toBeGreaterThan(60 + BPMN_GATEWAY_HALF_SIZE)
  })

  it('does not render an empty decision caption', () => {
    const { container } = render(
      <svg>
        <Gateway id="gateway-1" x={80} y={60} name="  " />
      </svg>,
    )

    expect(container.querySelector('text')).toBeNull()
  })
})
