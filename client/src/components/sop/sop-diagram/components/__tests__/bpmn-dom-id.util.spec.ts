import { describe, expect, it } from 'vitest'
import { createBpmnDomIds } from '../bpmn-dom-id.util'

describe('createBpmnDomIds', () => {
  it('isolates containers and rendered shape ids while preserving logical ids outside the DOM mapper', () => {
    const preview = createBpmnDomIds(':r1:', 0)
    const pdfExport = createBpmnDomIds(':sop-diagram-export-bpmn-2-r1:', 0)

    expect(preview.containerId).not.toBe(pdfExport.containerId)
    expect(preview.shapeId('bpmn-step-3')).not.toBe(pdfExport.shapeId('bpmn-step-3'))
    expect(preview.shapeId('bpmn-step-3')).toContain('bpmn-step-3')
    expect(pdfExport.shapeId('bpmn-step-3')).toContain('bpmn-step-3')
  })
})
