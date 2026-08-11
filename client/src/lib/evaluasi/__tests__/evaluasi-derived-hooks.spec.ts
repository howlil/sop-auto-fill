import { describe, expect, it } from 'vitest'
import { buildKepalaOpdPengajuanQueryParams } from '../hooks/evaluasi-derived-hooks'

describe('buildKepalaOpdPengajuanQueryParams', () => {
  it('should_keep_query_enabled_when_opd_id_is_missing', () => {
    expect(buildKepalaOpdPengajuanQueryParams()).toEqual({
      statusIn: ['DITANDATANGANI_PJ_PENYUSUN', 'SELESAI'],
      enabled: true,
    })
  })

  it('should_send_trimmed_opd_id_when_available', () => {
    expect(buildKepalaOpdPengajuanQueryParams(' opd-1 ')).toEqual({
      opdId: 'opd-1',
      statusIn: ['DITANDATANGANI_PJ_PENYUSUN', 'SELESAI'],
      enabled: true,
    })
  })
})
