import type { PengajuanTimelineNilaiEntry } from '@/types/dto/evaluasi.dto'

/** Idle window antar log penilaian yang masih dianggap satu sesi (10 menit). */
export const LOG_NILAI_EVALUASI_IDLE_MS = 10 * 60 * 1000

export interface LogNilaiEvaluasiSession {
  readonly id: string
  readonly evaluatorId: string
  readonly evaluatorNama: string
  readonly createdAt: string
  readonly hasilSebelum?: PengajuanTimelineNilaiEntry['hasilSebelum']
  readonly hasilSesudah?: PengajuanTimelineNilaiEntry['hasilSesudah']
  readonly catatanSesudah?: string
  readonly count: number
}

function parseTime(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/**
 * Gabung entri log penilaian berurutan (evaluator sama, selisih waktu < idleMs).
 * Asumsi input terurut terbaru di atas (sesuai respons workspace).
 */
export function groupLogNilaiEvaluasiSessions(
  entries: readonly PengajuanTimelineNilaiEntry[],
  idleMs: number = LOG_NILAI_EVALUASI_IDLE_MS,
): LogNilaiEvaluasiSession[] {
  if (entries.length === 0) {
    return []
  }
  const sessions: LogNilaiEvaluasiSession[] = []
  for (const entry of entries) {
    const prev = sessions[sessions.length - 1]
    const gap =
      prev === undefined
        ? idleMs + 1
        : Math.abs(parseTime(prev.createdAt) - parseTime(entry.createdAt))
    if (
      prev !== undefined &&
      prev.evaluatorId === entry.evaluatorId &&
      gap < idleMs
    ) {
      sessions[sessions.length - 1] = {
        id: prev.id,
        evaluatorId: prev.evaluatorId,
        evaluatorNama: prev.evaluatorNama,
        createdAt: prev.createdAt,
        hasilSebelum: entry.hasilSebelum ?? prev.hasilSebelum,
        hasilSesudah: prev.hasilSesudah ?? entry.hasilSesudah,
        catatanSesudah: prev.catatanSesudah ?? entry.catatanSesudah,
        count: prev.count + 1,
      }
    } else {
      sessions.push({
        id: entry.id,
        evaluatorId: entry.evaluatorId,
        evaluatorNama: entry.evaluatorNama,
        createdAt: entry.createdAt,
        hasilSebelum: entry.hasilSebelum,
        hasilSesudah: entry.hasilSesudah,
        catatanSesudah: entry.catatanSesudah,
        count: 1,
      })
    }
  }
  return sessions
}
