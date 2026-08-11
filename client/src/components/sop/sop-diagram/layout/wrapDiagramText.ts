/** Target karakter per baris pada label shape diagram (task / keputusan). */
export const DIAGRAM_MAX_CHARS_PER_LINE = 15

/** Lebar maksimum shape task agar diagram tidak melebar horizontal. */
export const DIAGRAM_MAX_SHAPE_WIDTH = 200

/** Perkiraan lebar karakter untuk fontSize 13 (konservatif agar teks tidak meluber). */
export const DIAGRAM_CHAR_WIDTH_APPROX = 9
export const DIAGRAM_LINE_HEIGHT = 15

/** Maks karakter per baris dari lebar area teks dalam kotak (px). */
export function getDiagramMaxCharsForInnerWidth(
  innerWidthPx: number,
  charWidth: number = DIAGRAM_CHAR_WIDTH_APPROX,
): number {
  return Math.max(6, Math.floor(Math.max(charWidth, innerWidthPx) / charWidth))
}

function chunkLongToken(token: string, maxLen: number): string[] {
  if (token.length <= maxLen) return [token]
  const chunks: string[] = []
  for (let i = 0; i < token.length; i += maxLen) {
    chunks.push(token.slice(i, i + maxLen))
  }
  return chunks
}

/**
 * Memecah teks menjadi baris untuk SVG diagram.
 * Kata panjang tanpa spasi dipotong per `maxCharsPerLine` (hindari shape melebar).
 */
export function wrapDiagramText(
  text: string,
  maxCharsPerLine: number = DIAGRAM_MAX_CHARS_PER_LINE,
): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length === 0) return []
  const lines: string[] = []
  let currentLine = ''
  const flushLine = (): void => {
    if (currentLine.length > 0) {
      lines.push(currentLine)
      currentLine = ''
    }
  }
  const appendPart = (part: string): void => {
    if (currentLine.length === 0) {
      currentLine = part
      return
    }
    if (currentLine.length + 1 + part.length <= maxCharsPerLine) {
      currentLine += ` ${part}`
      return
    }
    flushLine()
    currentLine = part
  }
  for (const word of normalized.split(' ')) {
    for (const part of chunkLongToken(word, maxCharsPerLine)) {
      appendPart(part)
    }
  }
  flushLine()
  return lines.length > 0 ? lines : chunkLongToken(normalized, maxCharsPerLine)
}

export interface MeasureDiagramTextBoxParams {
  lines: string[]
  minWidth: number
  minHeight: number
  charWidth?: number
  lineHeight?: number
  horizontalPadding?: number
  verticalPadding?: number
  maxWidth?: number
}

/** Ukuran kotak shape dari baris teks yang sudah di-wrap. */
export function measureDiagramTextBox(params: MeasureDiagramTextBoxParams): {
  width: number
  height: number
} {
  const {
    lines,
    minWidth,
    minHeight,
    charWidth = DIAGRAM_CHAR_WIDTH_APPROX,
    lineHeight = DIAGRAM_LINE_HEIGHT,
    horizontalPadding = 20,
    verticalPadding = 20,
    maxWidth = DIAGRAM_MAX_SHAPE_WIDTH,
  } = params
  if (lines.length === 0) return { width: minWidth, height: minHeight }
  const longestLength = lines.reduce((max, line) => Math.max(max, line.length), 0)
  const rawWidth = longestLength * charWidth + horizontalPadding * 2
  const width = Math.min(maxWidth, Math.max(minWidth, rawWidth))
  const height = Math.max(minHeight, lines.length * lineHeight + verticalPadding * 2)
  return { width, height }
}

export interface MeasureDiagramTaskBoxOptions {
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  horizontalPadding?: number
  verticalPadding?: number
  charWidth?: number
  lineHeight?: number
  minCharsPerLine?: number
}

/** Ukuran kotak task dari teks (layout engine + metrics). */
export function measureDiagramTaskBox(
  text: string,
  options: MeasureDiagramTaskBoxOptions = {},
): { lines: string[]; width: number; height: number } {
  const maxWidth = options.maxWidth ?? DIAGRAM_MAX_SHAPE_WIDTH
  const horizontalPadding = options.horizontalPadding ?? 20
  const verticalPadding = options.verticalPadding ?? 20
  const minWidth = options.minWidth ?? 80
  const minHeight = options.minHeight ?? 40
  const charWidth = options.charWidth ?? DIAGRAM_CHAR_WIDTH_APPROX
  const minChars = options.minCharsPerLine ?? 6
  const innerWidth = Math.max(charWidth, maxWidth - horizontalPadding * 2)
  const maxChars = Math.max(
    minChars,
    getDiagramMaxCharsForInnerWidth(innerWidth, charWidth),
  )
  const lines = wrapDiagramText(text, maxChars)
  const box = measureDiagramTextBox({
    lines,
    minWidth,
    minHeight,
    horizontalPadding,
    verticalPadding,
    maxWidth,
    charWidth,
    lineHeight: options.lineHeight,
  })
  return { lines, width: box.width, height: box.height }
}

export interface LayoutDiagramTaskLabelOptions {
  horizontalPadding?: number
  verticalPadding?: number
  minCharsPerLine?: number
  charWidth?: number
  lineHeight?: number
}

/** Membungkus label task agar muat di kotak layout (render Activity). */
export function layoutDiagramTaskLabel(
  text: string,
  boxWidth: number,
  _boxHeight: number,
  options: LayoutDiagramTaskLabelOptions = {},
): string[] {
  const horizontalPadding = options.horizontalPadding ?? 20
  const minChars = options.minCharsPerLine ?? 10
  const charWidth = options.charWidth ?? DIAGRAM_CHAR_WIDTH_APPROX
  const innerWidth = Math.max(charWidth, boxWidth - horizontalPadding * 2)
  const maxChars = Math.max(minChars, getDiagramMaxCharsForInnerWidth(innerWidth, charWidth))
  return wrapDiagramText(text, maxChars)
}
