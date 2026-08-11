import {
  DIAGRAM_MAX_SHAPE_WIDTH,
  measureDiagramTaskBox,
  measureDiagramTextBox,
  wrapDiagramText,
} from './wrapDiagramText'

/** Radius lingkaran Mulai/Selesai (SVG). */
export const BPMN_EVENT_RADIUS = 26

/** Kotak layout untuk terminator (selaras dengan diameter lingkaran). */
export const BPMN_EVENT_SIZE = BPMN_EVENT_RADIUS * 2

/** Setengah sisi diamond gateway (jarak pusat ke sudut). */
export const BPMN_GATEWAY_HALF_SIZE = 28

export const BPMN_GATEWAY_SIZE = BPMN_GATEWAY_HALF_SIZE * 2

export const BPMN_TASK_MIN_WIDTH = 96
export const BPMN_TASK_MIN_HEIGHT = 44

/** Target minimum karakter per baris label task BPMN (hindari kotak "panci" vertikal). */
export const BPMN_TASK_MIN_CHARS_PER_LINE = 14

/** Lebar task ideal saat ada ruang kolom (prioritas keterbacaan). */
export const BPMN_TASK_PREFERRED_MAX_WIDTH = 168

/** Padding kotak task — harus sama dengan Activity.tsx dan layout engine. */
export const BPMN_TASK_PADDING = 14

/** Tinggi minimum satu swimlane horizontal. */
export const BPMN_BASE_ROW_HEIGHT = 152

/** Jarak antar baris swimlane. */
export const BPMN_ROW_SPACING = 16

/** Jarak antar kolom langkah (px). */
export const BPMN_COLUMN_SPACING = 24

export const BPMN_BASE_X = 8

/** Margin kanan kanvas — ruang terminator Selesai + mata panah keluar (hindari kepotong). */
export const BPMN_RIGHT_MARGIN = 48

/** Ruang vertikal di swimlane di atas/bawah shape tertinggi — swimlane lebih panjang ke bawah. */
export const BPMN_LANE_STEP_PADDING = 72

/** Lebar minimum satu kolom langkah. */
export const BPMN_COLUMN_MIN_WIDTH = 108

/** Padding dalam kolom di sisi shape. */
export const BPMN_COLUMN_INNER_PADDING = 12

/** Jarak minimum antar tepi shape dalam satu swimlane (px). */
export const BPMN_LANE_MIN_STEP_GAP = 20

/** Jarak ekstra lebar kolom jika ada decision/gateway. */
export const BPMN_GATEWAY_EXTRA_GAP = 20

/** Offset teks decision di bawah pusat diamond (global Y). */
export const BPMN_DECISION_TEXT_OFFSET_Y = BPMN_GATEWAY_HALF_SIZE + 24

/** Padding antar rect saat deteksi tabrakan layout. */
export const BPMN_COLLISION_PADDING = 20

/** Lebar kertas A4 landscape pada 96dpi: 297mm. */
export const A4_LANDSCAPE_WIDTH_PX = Math.floor((297 * 96) / 25.4)

/** Lebar pool cetak SOP: calc(297mm - 3cm), sinkron dengan sopDocumentLayout.ts. */
export const BPMN_SOP_CONTENT_MAX_WIDTH_PX = Math.floor(((297 - 30) * 96) / 25.4)

export interface BpmnStepDimensions {
  width: number
  height: number
  /** Tinggi tambahan di bawah diamond untuk label keputusan. */
  decisionTextReserve: number
}

function measureDecisionTextReserve(stepName: string | undefined): number {
  if (!stepName?.trim()) return BPMN_DECISION_TEXT_OFFSET_Y + 24
  const lines = wrapDiagramText(stepName)
  const box = measureDiagramTextBox({
    lines,
    minWidth: BPMN_TASK_MIN_WIDTH,
    minHeight: 24,
    horizontalPadding: BPMN_TASK_PADDING,
    verticalPadding: 8,
  })
  return BPMN_DECISION_TEXT_OFFSET_Y + box.height
}

/** Ukuran layout per tipe step (routing + obstacle + lane height). */
export function getBpmnStepLayoutDimensions(
  stepName: string | undefined,
  stepType: string,
  maxShapeWidth?: number,
): BpmnStepDimensions {
  const maxWidth = maxShapeWidth ?? DIAGRAM_MAX_SHAPE_WIDTH
  if (stepType === 'terminator') {
    return {
      width: BPMN_EVENT_SIZE,
      height: BPMN_EVENT_SIZE,
      decisionTextReserve: 0,
    }
  }
  if (stepType === 'decision') {
    return {
      width: BPMN_GATEWAY_SIZE,
      height: BPMN_GATEWAY_SIZE,
      decisionTextReserve: measureDecisionTextReserve(stepName),
    }
  }
  if (stepType !== 'task') {
    return {
      width: BPMN_TASK_MIN_WIDTH,
      height: BPMN_TASK_MIN_HEIGHT,
      decisionTextReserve: 0,
    }
  }
  if (!stepName) {
    return {
      width: BPMN_TASK_MIN_WIDTH,
      height: BPMN_TASK_MIN_HEIGHT,
      decisionTextReserve: 0,
    }
  }
  const box = measureDiagramTaskBox(stepName, {
    minWidth: BPMN_TASK_MIN_WIDTH,
    minHeight: BPMN_TASK_MIN_HEIGHT,
    horizontalPadding: BPMN_TASK_PADDING,
    verticalPadding: BPMN_TASK_PADDING,
    maxWidth: Math.min(maxWidth, BPMN_TASK_PREFERRED_MAX_WIDTH),
    minCharsPerLine: BPMN_TASK_MIN_CHARS_PER_LINE,
  })
  return {
    width: box.width,
    height: box.height,
    decisionTextReserve: 0,
  }
}
