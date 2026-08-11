import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  areSopDiagramRootsReady,
  getPrintScope,
  isSopDiagramRootReady,
  suppressBrowserPrintChrome,
  waitForSopDiagramPrintReady,
} from '../sop-browser-print'

function buildPrintDom(options: {
  flowchartConnections: number
  flowchartPaths: number
  bpmnConnections: number
  bpmnPaths: number
}): void {
  document.body.innerHTML = `
    <div data-print-area="sop">
      <div class="sop-print-diagram-flowchart">
        <div data-sop-diagram-root data-sop-connection-count="${options.flowchartConnections}">
          <svg class="sop-diagram-overlay">
            ${Array.from({ length: options.flowchartPaths })
              .map(() => '<path class="sop-connector-stroke" d="M0 0 L40 0 L40 20" />')
              .join('')}
          </svg>
        </div>
      </div>
      <div class="sop-print-diagram-bpmn">
        <div data-sop-diagram-root data-sop-connection-count="${options.bpmnConnections}">
          <svg class="sop-diagram-overlay">
            ${Array.from({ length: options.bpmnPaths })
              .map(() => '<path class="sop-connector-stroke" d="M10 10 L80 10 L80 60" />')
              .join('')}
          </svg>
        </div>
      </div>
    </div>
  `
}

describe('isSopDiagramRootReady', () => {
  it('menganggap siap bila tidak ada koneksi', () => {
    document.body.innerHTML =
      '<div data-sop-diagram-root data-sop-connection-count="0"></div>'
    const root = document.querySelector('[data-sop-diagram-root]')!
    expect(isSopDiagramRootReady(root)).toBe(true)
  })

  it('menganggap siap bila jumlah path valid >= koneksi', () => {
    document.body.innerHTML = `
      <div data-sop-diagram-root data-sop-connection-count="2">
        <svg class="sop-diagram-overlay">
          <path class="sop-connector-stroke" d="M0 0 L10 0" />
          <path class="sop-connector-stroke" d="M0 0 L20 0 L20 10" />
        </svg>
      </div>
    `
    const root = document.querySelector('[data-sop-diagram-root]')!
    expect(isSopDiagramRootReady(root)).toBe(true)
  })

  it('menganggap BPMN siap walau SVG panah tidak memakai class overlay flowchart', () => {
    document.body.innerHTML = `
      <div data-sop-diagram-root data-sop-connection-count="1">
        <svg>
          <path class="sop-connector-stroke" d="M10 10 L80 10 L80 60" />
        </svg>
      </div>
    `
    const root = document.querySelector('[data-sop-diagram-root]')!
    expect(isSopDiagramRootReady(root)).toBe(true)
  })

  it('belum siap bila path belum cukup', () => {
    document.body.innerHTML = `
      <div data-sop-diagram-root data-sop-connection-count="2">
        <svg class="sop-diagram-overlay">
          <path class="sop-connector-stroke" d="M0 0 L10 0" />
        </svg>
      </div>
    `
    const root = document.querySelector('[data-sop-diagram-root]')!
    expect(isSopDiagramRootReady(root)).toBe(false)
  })
})

describe('areSopDiagramRootsReady', () => {
  beforeEach(() => {
    buildPrintDom({
      flowchartConnections: 1,
      flowchartPaths: 1,
      bpmnConnections: 1,
      bpmnPaths: 1,
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('true bila flowchart dan BPMN siap', () => {
    expect(areSopDiagramRootsReady(document)).toBe(true)
  })

  it('false bila host BPMN belum ada', () => {
    document.querySelector('.sop-print-diagram-bpmn')?.remove()
    expect(areSopDiagramRootsReady(document)).toBe(false)
  })

  it('dapat mengecek flowchart secara terpisah untuk ekspor serial', () => {
    document.querySelector('.sop-print-diagram-bpmn')?.remove()
    expect(areSopDiagramRootsReady(document, ['flowchart'])).toBe(true)
  })
})

describe('suppressBrowserPrintChrome', () => {
  it('mengosongkan judul dokumen lalu mengembalikan setelah restore', () => {
    const previousTitle = document.title
    document.title = 'SOPFlow'
    const restore = suppressBrowserPrintChrome()
    expect(document.title).toBe('\u00a0')
    restore()
    expect(document.title).toBe('SOPFlow')
    document.title = previousTitle
  })
})

describe('getPrintScope', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('memakai lapisan data-print-area="sop" pertama', () => {
    document.body.innerHTML = `
      <div data-print-area="sop" class="hidden" id="print-layer"></div>
    `
    const printLayer = document.getElementById('print-layer')!
    expect(getPrintScope()).toBe(printLayer)
  })
})

describe('waitForSopDiagramPrintReady', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.body.className = ''
  })

  it('langsung resolve true bila diagram sudah siap', async () => {
    buildPrintDom({
      flowchartConnections: 1,
      flowchartPaths: 1,
      bpmnConnections: 0,
      bpmnPaths: 0,
    })
    await expect(waitForSopDiagramPrintReady({ timeoutMs: 500 })).resolves.toBe(true)
  })
})
