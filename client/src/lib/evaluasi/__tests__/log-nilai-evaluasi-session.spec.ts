import { describe, expect, it } from 'vitest'
import {
  groupLogNilaiEvaluasiSessions,
  LOG_NILAI_EVALUASI_IDLE_MS,
} from '../log-nilai-evaluasi-session'
import type { PengajuanTimelineNilaiEntry } from '@/types/dto/evaluasi.dto'

function entry(
  partial: Partial<PengajuanTimelineNilaiEntry> & Pick<PengajuanTimelineNilaiEntry, 'id' | 'createdAt'>,
): PengajuanTimelineNilaiEntry {
  return {
    sopDetailId: 'detail-1',
    evaluatorId: 'eval-1',
    evaluatorNama: 'Budi',
    ...partial,
  }
}

describe('groupLogNilaiEvaluasiSessions', () => {
  it('should_merge_three_logs_within_idle_window_into_one_session', () => {
    const base = Date.parse('2026-05-19T10:00:00.000Z')
    const input: PengajuanTimelineNilaiEntry[] = [
      entry({
        id: '3',
        createdAt: new Date(base + 5 * 60_000).toISOString(),
        hasilSesudah: 'SESUAI',
      }),
      entry({
        id: '2',
        createdAt: new Date(base + 3 * 60_000).toISOString(),
        hasilSebelum: 'BELUM_DINILAI',
        hasilSesudah: 'PERLU_PERBAIKAN',
      }),
      entry({
        id: '1',
        createdAt: new Date(base).toISOString(),
        hasilSebelum: 'BELUM_DINILAI',
        hasilSesudah: 'BELUM_DINILAI',
      }),
    ]
    const actual = groupLogNilaiEvaluasiSessions(input, LOG_NILAI_EVALUASI_IDLE_MS)
    expect(actual).toHaveLength(1)
    expect(actual[0]?.count).toBe(3)
    expect(actual[0]?.evaluatorNama).toBe('Budi')
  })

  it('should_split_sessions_when_idle_gap_exceeds_window', () => {
    const base = Date.parse('2026-05-19T10:00:00.000Z')
    const input: PengajuanTimelineNilaiEntry[] = [
      entry({
        id: '2',
        createdAt: new Date(base + 20 * 60_000).toISOString(),
        hasilSesudah: 'SESUAI',
      }),
      entry({
        id: '1',
        createdAt: new Date(base).toISOString(),
        hasilSesudah: 'PERLU_PERBAIKAN',
      }),
    ]
    const actual = groupLogNilaiEvaluasiSessions(input, LOG_NILAI_EVALUASI_IDLE_MS)
    expect(actual).toHaveLength(2)
    expect(actual[0]?.count).toBe(1)
    expect(actual[1]?.count).toBe(1)
  })

  it('should_not_merge_different_evaluators', () => {
    const t = '2026-05-19T10:05:00.000Z'
    const input: PengajuanTimelineNilaiEntry[] = [
      entry({
        id: 'b',
        evaluatorId: 'eval-2',
        evaluatorNama: 'Ani',
        createdAt: t,
      }),
      entry({
        id: 'a',
        evaluatorId: 'eval-1',
        evaluatorNama: 'Budi',
        createdAt: '2026-05-19T10:00:00.000Z',
      }),
    ]
    const actual = groupLogNilaiEvaluasiSessions(input)
    expect(actual).toHaveLength(2)
  })
})
