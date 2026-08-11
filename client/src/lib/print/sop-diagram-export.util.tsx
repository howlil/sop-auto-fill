import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { toPng } from 'html-to-image'
import type { PenyusunWorkbenchDiagramKonfigurasi } from '@/types/dto/sop.dto'
import type { ProsedurRow } from '@/types/ui/sop'
import { SopDiagramExportHost } from '@/lib/print/sop-diagram-export-host'
import {
  waitForSopDiagramPrintReady,
  type SopDiagramKind,
} from '@/lib/print/sop-browser-print'
import { waitForPaintFrames } from '@/lib/print/print-frame-wait'

export interface DiagramPageSnapshot {
  kind: 'flowchart' | 'bpmn'
  pageIndex: number
  dataUrl: string
  width: number
  height: number
}

export interface SopDiagramExportInput {
  name?: string
  prosedurRows: ProsedurRow[]
  implementers: { id: string; name: string }[]
  diagramKonfigurasi?: PenyusunWorkbenchDiagramKonfigurasi
}

export type DiagramSnapshotKind = SopDiagramKind

const EXPORT_ROOT_STYLE =
  'position:fixed;left:-16000px;top:0;width:297mm;background:#fff;pointer-events:none;z-index:-1;'

const snapshotCache = new Map<string, DiagramPageSnapshot[]>()
let exportHostSequence = 0

/** Timeout default (ms) untuk menunggu diagram siap di-export. */
const DEFAULT_EXPORT_TIMEOUT_MS = 15_000
/** Jumlah retry jika percobaan pertama gagal (render ulang dari awal). */
const MAX_EXPORT_RETRIES = 2
/** Delay antar retry (ms) — beri waktu browser GC / relayout. */
const RETRY_DELAY_MS = 500

/** Tunggu beberapa paint frame (lebih panjang dari waitForPrintPaint). */
function waitForSettledPaint(frames = 4): Promise<void> {
  return waitForPaintFrames(frames)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function buildCacheKey(input: SopDiagramExportInput): string {
  return JSON.stringify({
    name: input.name,
    rows: input.prosedurRows,
    implementers: input.implementers,
    diagramKonfigurasi: input.diagramKonfigurasi,
  })
}

/** Kunci cache ekspor diagram (untuk tes & debugging). */
export function buildSopDiagramExportCacheKey(input: SopDiagramExportInput): string {
  return buildCacheKey(input)
}

async function exportPrintPageElement(
  element: HTMLElement,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const width = Math.max(Math.ceil(element.scrollWidth), Math.ceil(element.offsetWidth))
  const height = Math.max(Math.ceil(element.scrollHeight), Math.ceil(element.offsetHeight))
  if (width <= 0 || height <= 0) {
    throw new Error('Ukuran halaman diagram tidak valid untuk diekspor')
  }
  const dataUrl = await toPng(element, {
    width,
    height,
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#ffffff',
  })
  return { dataUrl, width, height }
}

async function exportPagesFromHost(
  root: ParentNode,
  hostSelector: string,
  kind: DiagramPageSnapshot['kind'],
): Promise<DiagramPageSnapshot[]> {
  const pages = root.querySelectorAll(`${hostSelector} .print-page`)
  const snapshots: DiagramPageSnapshot[] = []
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]
    if (!(page instanceof HTMLElement)) {
      continue
    }
    const { dataUrl, width, height } = await exportPrintPageElement(page)
    snapshots.push({ kind, pageIndex: index, dataUrl, width, height })
  }
  return snapshots
}

/**
 * Satu percobaan mount + tunggu + export.
 * Mengembalikan snapshot[] atau null jika gagal/timeout.
 */
async function tryExportKindOnce(
  input: SopDiagramExportInput,
  timeoutMs: number,
  kind: DiagramSnapshotKind,
): Promise<DiagramPageSnapshot[] | null> {
  const container = document.createElement('div')
  container.setAttribute('data-sop-diagram-export-container', '')
  container.style.cssText = EXPORT_ROOT_STYLE
  document.body.appendChild(container)
  exportHostSequence += 1
  const root = createRoot(container, {
    identifierPrefix: `sop-diagram-export-${kind}-${exportHostSequence}-`,
  })
  try {
    flushSync(() => {
      root.render(<SopDiagramExportHost input={input} kinds={[kind]} />)
    })
    // Beri waktu lebih lama agar React useEffect / useLayoutEffect selesai berjalan
    // dan DOM layout terukur sebelum kita mulai polling readiness.
    await waitForSettledPaint(6)

    const ready = await waitForSopDiagramPrintReady({
      scope: container,
      timeoutMs,
      requiredKinds: [kind],
    })
    if (!ready) {
      return null
    }

    // Tunggu beberapa frame lagi untuk memastikan semua path tertulis ke DOM
    await waitForSettledPaint(4)

    const exported = await exportPagesFromHost(
      container,
      `.sop-print-diagram-${kind}`,
      kind,
    )
    return exported.length > 0 ? exported : null
  } finally {
    root.unmount()
    container.remove()
  }
}

/** Ekspor halaman flowchart + BPMN ke PNG untuk embed PDF. */
export async function exportSopDiagramSnapshots(
  input: SopDiagramExportInput,
  options: { useCache?: boolean; timeoutMs?: number; requiredKinds?: DiagramSnapshotKind[] } = {},
): Promise<DiagramPageSnapshot[]> {
  const useCache = options.useCache ?? true
  const requiredKinds = options.requiredKinds ?? []
  const hasRequiredKinds = (snapshots: DiagramPageSnapshot[]) =>
    requiredKinds.every((kind) => snapshots.some((snapshot) => snapshot.kind === kind))
  const cacheKey = buildCacheKey(input)
  if (useCache) {
    const cached = snapshotCache.get(cacheKey)
    if (cached != null && cached.length > 0 && hasRequiredKinds(cached)) {
      return cached
    }
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_EXPORT_TIMEOUT_MS

  const kindsToExport = requiredKinds.length > 0
    ? [...new Set(requiredKinds)]
    : (['flowchart', 'bpmn'] as DiagramSnapshotKind[])
  const exported: DiagramPageSnapshot[] = []

  // Route one diagram at a time. Both algorithms are CPU-heavy for complex SOPs,
  // and mounting them together makes readiness race against main-thread work.
  for (const kind of kindsToExport) {
    let kindSnapshots: DiagramPageSnapshot[] | null = null
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= MAX_EXPORT_RETRIES; attempt += 1) {
      if (attempt > 0) {
        await delay(RETRY_DELAY_MS)
      }
      try {
        kindSnapshots = await tryExportKindOnce(input, timeoutMs, kind)
        if (kindSnapshots != null && kindSnapshots.length > 0) {
          break
        }
        lastError = new Error(`Percobaan ke-${attempt + 1}: diagram ${kind} belum siap`)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }
    if (kindSnapshots == null || kindSnapshots.length === 0) {
      throw new Error(
        `Diagram ${kind} gagal dirender setelah ${MAX_EXPORT_RETRIES + 1} percobaan. ` +
        (lastError?.message ?? ''),
      )
    }
    exported.push(...kindSnapshots)
  }

  if (useCache && exported.length > 0 && hasRequiredKinds(exported)) {
    snapshotCache.set(cacheKey, exported)
  }
  return exported
}

export function clearSopDiagramSnapshotCache(): void {
  snapshotCache.clear()
}
