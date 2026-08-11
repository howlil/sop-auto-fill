import {
  wrapDiagramText,
  measureDiagramTextBox,
  measureDiagramTaskBox,
  layoutDiagramTaskLabel,
  DIAGRAM_MAX_CHARS_PER_LINE,
  DIAGRAM_CHAR_WIDTH_APPROX,
} from '../wrapDiagramText'
import { BPMN_TASK_PADDING } from '../bpmnDiagramMetrics'

describe('wrapDiagramText', () => {
  it('should_wrap_long_unbroken_token_into_multiple_lines', () => {
    const lines = wrapDiagramText('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.every((l) => l.length <= DIAGRAM_MAX_CHARS_PER_LINE)).toBe(true)
  })

  it('should_wrap_words_with_spaces_normally', () => {
    const lines = wrapDiagramText('ini contoh peringatan singkat')
    expect(lines.join(' ')).toContain('ini contoh')
  })
})

describe('measureDiagramTextBox', () => {
  it('should_cap_width_when_lines_are_long', () => {
    const lines = wrapDiagramText('a'.repeat(80))
    const { width } = measureDiagramTextBox({ lines, minWidth: 90, minHeight: 50 })
    expect(width).toBeLessThanOrEqual(200)
  })

  it('should_include_both_horizontal_paddings_in_width', () => {
    const lines = ['12345']
    const pad = 14
    const { width } = measureDiagramTextBox({
      lines,
      minWidth: 0,
      minHeight: 0,
      horizontalPadding: pad,
      charWidth: DIAGRAM_CHAR_WIDTH_APPROX,
    })
    expect(width).toBe(5 * DIAGRAM_CHAR_WIDTH_APPROX + pad * 2)
  })
})

describe('measureDiagramTaskBox', () => {
  it('should_keep_long_indonesian_label_within_max_width', () => {
    const label = 'Selesai: Mendokumentasikan hasil imunisasi rutin.'
    const { width, lines } = measureDiagramTaskBox(label, {
      maxWidth: 160,
      horizontalPadding: BPMN_TASK_PADDING,
      verticalPadding: BPMN_TASK_PADDING,
    })
    const longest = lines.reduce((max, line) => Math.max(max, line.length), 0)
    expect(width).toBeLessThanOrEqual(160)
    expect(longest * DIAGRAM_CHAR_WIDTH_APPROX + BPMN_TASK_PADDING * 2).toBeLessThanOrEqual(160)
  })
})

describe('layoutDiagramTaskLabel', () => {
  it('should_wrap_lines_to_fit_fixed_layout_box', () => {
    const label = 'Selesai: Mendokumentasikan hasil imunisasi rutin.'
    const lines = layoutDiagramTaskLabel(label, 140, 56, {
      horizontalPadding: BPMN_TASK_PADDING,
      verticalPadding: BPMN_TASK_PADDING,
    })
    const maxChars = Math.max(...lines.map((l) => l.length))
    const innerMax = Math.floor((140 - BPMN_TASK_PADDING * 2) / DIAGRAM_CHAR_WIDTH_APPROX)
    expect(maxChars).toBeLessThanOrEqual(innerMax)
  })
})
