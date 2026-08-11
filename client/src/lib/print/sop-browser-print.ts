import { waitForPaintFrames } from './print-frame-wait'

export const SOP_PRINT_READY_TIMEOUT_MS = 6000
export const SOP_PRINT_POLL_INTERVAL_MS = 80
const MIN_PATH_D_LENGTH = 8

export interface WaitForSopDiagramPrintReadyOptions {
  timeoutMs?: number
  scope?: ParentNode
  requiredKinds?: SopDiagramKind[]
}



/** Judul kosong mengurangi header bawaan browser (tanggal/judul) di dialog cetak. */
export function suppressBrowserPrintChrome(): () => void {
  const previousTitle = document.title
  document.title = '\u00a0'
  return () => {
    document.title = previousTitle
  }
}

export type SopDiagramKind = 'flowchart' | 'bpmn'

const ALL_SOP_DIAGRAM_KINDS: SopDiagramKind[] = ['flowchart', 'bpmn']

function waitForPrintPaint(): Promise<void> {
  return waitForPaintFrames(2)
}

function getExpectedConnectionCount(root: Element): number {
  const raw = root.getAttribute('data-sop-connection-count')
  if (raw == null) return 0
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function countValidConnectorPaths(root: Element): number {
  const paths = root.querySelectorAll('path.sop-connector-stroke[d]')
  let valid = 0
  paths.forEach((path) => {
    const d = path.getAttribute('d')
    if (d != null && d.length >= MIN_PATH_D_LENGTH) valid += 1
  })
  return valid
}

export function isSopDiagramRootReady(root: Element): boolean {
  const expected = getExpectedConnectionCount(root)
  if (expected === 0) return true
  return countValidConnectorPaths(root) >= expected
}

function hostSelectorForKind(kind: SopDiagramKind): string {
  return `.sop-print-diagram-${kind}`
}

function collectRequiredDiagramRoots(
  scope: ParentNode,
  requiredKinds: SopDiagramKind[] = ALL_SOP_DIAGRAM_KINDS,
): Element[] {
  const roots: Element[] = []
  for (const kind of requiredKinds) {
    const host = scope.querySelector(hostSelectorForKind(kind))
    if (host == null) return []
    const kindRoots = [...host.querySelectorAll('[data-sop-diagram-root]')]
    if (kindRoots.length === 0) return []
    roots.push(...kindRoots)
  }
  return roots
}

export function areSopDiagramRootsReady(
  scope: ParentNode = document,
  requiredKinds: SopDiagramKind[] = ALL_SOP_DIAGRAM_KINDS,
): boolean {
  const roots = collectRequiredDiagramRoots(scope, requiredKinds)
  if (roots.length === 0) return false
  return roots.every((root) => isSopDiagramRootReady(root))
}

export function debugSopDiagramRoots(
  scope: ParentNode = document,
  requiredKinds: SopDiagramKind[] = ALL_SOP_DIAGRAM_KINDS,
): void {
  for (const kind of requiredKinds) {
    console.log(`[DEBUG] ${kind}Host ada?`, scope.querySelector(hostSelectorForKind(kind)) != null)
  }

  const roots = collectRequiredDiagramRoots(scope, requiredKinds)
  console.log('[DEBUG] Jumlah root diagram:', roots.length)

  roots.forEach((root, idx) => {
    const expected = getExpectedConnectionCount(root)
    const validPaths = countValidConnectorPaths(root)
    const rawPaths = root.querySelectorAll('path.sop-connector-stroke').length
    const id = root.getAttribute('id') || `root-${idx}`
    console.log(`[DEBUG] Root ${id}: expected=${expected}, validPaths=${validPaths}, rawPaths=${rawPaths}`)
  })
}

/** Area cetak khusus SOP (lapisan tersembunyi jika ada, seperti sebelumnya). */
export function getPrintScope(): ParentNode {
  const dedicated = document.querySelector('[data-print-area="sop"]')
  return dedicated ?? document
}

/** Apakah host diagram sudah ter-mount di scope? */
function hasDiagramHostsMounted(
  scope: ParentNode,
  requiredKinds: SopDiagramKind[] = ALL_SOP_DIAGRAM_KINDS,
): boolean {
  return requiredKinds.every((kind) => scope.querySelector(hostSelectorForKind(kind)) != null)
}

/** Tunggu flowchart + BPMN selesai merender path. */
export async function waitForSopDiagramPrintReady(
  options: WaitForSopDiagramPrintReadyOptions = {},
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? SOP_PRINT_READY_TIMEOUT_MS
  const scope = options.scope ?? getPrintScope()
  const requiredKinds = options.requiredKinds ?? ALL_SOP_DIAGRAM_KINDS
  const deadline = Date.now() + timeoutMs

  // Fase 1: tunggu sampai host diagram ter-mount (React perlu beberapa siklus effect)
  while (Date.now() < deadline) {
    await waitForPrintPaint()
    if (hasDiagramHostsMounted(scope, requiredKinds)) break
    await new Promise((resolve) => {
      window.setTimeout(resolve, SOP_PRINT_POLL_INTERVAL_MS)
    })
  }

  // Fase 2: tunggu sampai semua root diagram dan connector path ter-render
  while (Date.now() < deadline) {
    await waitForPrintPaint()
    if (areSopDiagramRootsReady(scope, requiredKinds)) return true
    // Gunakan polling interval yang lebih panjang setelah beberapa iterasi
    // untuk memberi waktu layout effect berjalan
    const remaining = deadline - Date.now()
    const interval = remaining > 4000 ? SOP_PRINT_POLL_INTERVAL_MS : 200
    await new Promise((resolve) => {
      window.setTimeout(resolve, interval)
    })
  }

  // Cek terakhir setelah timeout — beri satu paint frame lagi
  await waitForPrintPaint()
  const isReady = areSopDiagramRootsReady(scope, requiredKinds)
  if (!isReady) {
    console.warn('[SOP PDF] Timeout menunggu diagram ready. Mendebug state saat ini:')
    debugSopDiagramRoots(scope, requiredKinds)
  }
  return isReady
}



