/**
 * Timeline aktivitas penilaian SOP di workspace evaluator.
 * Log beruntun dalam idle window digabung di klien (mirip tab Aktivitas log edit SOP).
 */
import { Activity } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import {
  groupLogNilaiEvaluasiSessions,
  type LogNilaiEvaluasiSession,
} from '@/lib/evaluasi/log-nilai-evaluasi-session'
import type { PengajuanTimelineNilaiEntry } from '@/types/dto/evaluasi.dto'

function formatTime(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatDayHeader(iso: string): string {
  if (!iso) return 'Hari ini'
  try {
    const d = new Date(iso)
    const today = new Date()
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    if (sameDay(d, today)) return 'Hari ini'
    if (sameDay(d, yesterday)) return 'Kemarin'
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function dayKey(iso: string): string {
  if (!iso) return 'unknown'
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  } catch {
    return iso
  }
}

function labelHasil(hasil: string | null | undefined): string {
  if (hasil === 'SESUAI') return 'Sesuai'
  if (hasil === 'PERLU_PERBAIKAN') return 'Perlu perbaikan'
  if (hasil === 'BELUM_DINILAI') return 'Belum dinilai'
  return hasil ?? '—'
}

function ringkasanPerubahan(session: LogNilaiEvaluasiSession): string {
  const sebelum = labelHasil(session.hasilSebelum)
  const sesudah = labelHasil(session.hasilSesudah)
  if (session.hasilSebelum === undefined && session.hasilSesudah !== undefined) {
    return sesudah
  }
  if (sebelum === sesudah) {
    return sesudah
  }
  return `${sebelum} → ${sesudah}`
}

interface RiwayatNilaiEvaluasiPanelProps {
  entries: PengajuanTimelineNilaiEntry[]
  isLoading?: boolean
}

export function RiwayatNilaiEvaluasiPanel({
  entries,
  isLoading = false,
}: RiwayatNilaiEvaluasiPanelProps) {
  if (isLoading && entries.length === 0) {
    return <LoadingState compact message="Memuat aktivitas penilaian…" />
  }

  const sessions = groupLogNilaiEvaluasiSessions(entries)

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="w-8 h-8" />}
        title="Belum ada aktivitas penilaian"
        description="Perubahan akan muncul setelah Anda menyimpan evaluasi."
      />
    )
  }

  const groups: Array<{
    key: string
    label: string
    items: LogNilaiEvaluasiSession[]
  }> = []
  for (const session of sessions) {
    const k = dayKey(session.createdAt)
    const existing = groups[groups.length - 1]
    if (existing !== undefined && existing.key === k) {
      existing.items.push(session)
    } else {
      groups.push({
        key: k,
        label: formatDayHeader(session.createdAt),
        items: [session],
      })
    }
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <LoadingState compact className="justify-start py-0" message="Memperbarui…" />
      ) : null}
      {groups.map((group) => (
        <div key={group.key}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
            {group.label}
          </p>
          <div className="relative pl-4">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            <ul className="space-y-3">
              {group.items.map((session) => {
                const summary = ringkasanPerubahan(session)
                const catatan = session.catatanSesudah?.trim()
                return (
                  <li key={session.id} className="relative flex gap-3">
                    <span className="absolute left-[-13px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
                        <span className="text-muted-foreground tabular-nums">
                          {formatTime(session.createdAt)}
                        </span>
                        <span className="font-medium text-foreground">
                          {session.evaluatorNama}
                        </span>
                        {session.count > 1 ? (
                          <span className="text-[10px] text-muted-foreground">
                            · {session.count} perubahan
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-secondary-foreground mt-0.5">{summary}</p>
                      {catatan ? (
                        <p
                          className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2"
                          title={catatan}
                        >
                          {catatan}
                        </p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ))}
    </div>
  )
}
