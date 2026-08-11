import { describe, expect, it } from 'vitest'
import {
  BERITA_ACARA_A4_HEIGHT_PT,
  BERITA_ACARA_A4_SIZE,
  BERITA_ACARA_A4_WIDTH_PT,
  BERITA_ACARA_MARGIN_BOTTOM_PT,
  BERITA_ACARA_MARGIN_SIDE_PT,
  BERITA_ACARA_MARGIN_TOP_PT,
} from '@/lib/pengajuan/berita-acara-page-metrics'

describe('berita-acara-page-metrics', () => {
  it('memakai dimensi A4 portrait standar dalam pt', () => {
    expect(BERITA_ACARA_A4_WIDTH_PT).toBe(595.28)
    expect(BERITA_ACARA_A4_HEIGHT_PT).toBe(841.89)
    expect(BERITA_ACARA_A4_WIDTH_PT).toBeLessThan(BERITA_ACARA_A4_HEIGHT_PT)
    expect(BERITA_ACARA_A4_SIZE).toEqual({
      width: BERITA_ACARA_A4_WIDTH_PT,
      height: BERITA_ACARA_A4_HEIGHT_PT,
    })
  })

  it('memakai margin surat resmi 3cm atas/samping dan 2.5cm bawah', () => {
    expect(BERITA_ACARA_MARGIN_TOP_PT).toBe(85.04)
    expect(BERITA_ACARA_MARGIN_SIDE_PT).toBe(85.04)
    expect(BERITA_ACARA_MARGIN_BOTTOM_PT).toBe(70.87)
  })
})
