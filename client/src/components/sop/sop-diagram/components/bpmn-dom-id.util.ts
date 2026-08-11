export interface BpmnDomIds {
  instancePrefix: string
  containerId: string
  shapeId: (logicalShapeId: string) => string
}

function toBpmnDomToken(reactId: string): string {
  return reactId.replace(/[^a-zA-Z0-9_-]/g, '-') || 'instance'
}

/**
 * Keep BPMN workflow IDs logical inside the layout engine, but isolate every
 * rendered DOM tree. A visible preview and the hidden PDF exporter may coexist.
 */
export function createBpmnDomIds(reactId: string, pageIndex: number): BpmnDomIds {
  const instancePrefix = `bpmn-${toBpmnDomToken(reactId)}-`
  return {
    instancePrefix,
    containerId: `${instancePrefix}container-${pageIndex}`,
    shapeId: (logicalShapeId) => `${instancePrefix}${logicalShapeId}`,
  }
}
