/**
 * Tab Aktivitas — riwayat edit SOP gaya Google Docs.
 *
 * Sumber data: `PenyusunWorkbenchLogEdit` dari workbench server.
 * Sesi yang masih `closedAt = null` ditandai "berlangsung".
 * Edit beruntun dalam idle window (10 menit) sudah digabung di server menjadi 1 entry.
 */
import { Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import type { PenyusunWorkbenchLogEdit } from '@/types/dto/sop.dto'

type BagianSop = PenyusunWorkbenchLogEdit['bagian']

const BAGIAN_LABEL: Record<BagianSop, string> = {
  HEADER: 'Header SOP',
  LANGKAH: 'Langkah',
  STATUS: 'Status',
}

const BAGIAN_BADGE_CLASS: Record<BagianSop, string> = {
  HEADER: 'bg-blue-100 text-blue-700 border-blue-200',
  LANGKAH: 'bg-purple-100 text-purple-700 border-purple-200',
  STATUS: 'bg-amber-100 text-amber-700 border-amber-200',
}

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

interface RiwayatStatusPanelProps {
  entries: PenyusunWorkbenchLogEdit[]
}

export function RiwayatStatusPanel({ entries }: RiwayatStatusPanelProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="w-8 h-8" />}
        title="Belum ada aktivitas"
        description="Perubahan SOP akan dicatat di sini, gabung otomatis selama 10 menit terakhir."
      />
    )
  }

  const groups: Array<{ key: string; label: string; items: PenyusunWorkbenchLogEdit[] }> = []
  for (const entry of entries) {
    const key = dayKey(entry.createdAt)
    const existing = groups[groups.length - 1]
    if (existing !== undefined && existing.key === key) {
      existing.items.push(entry)
    } else {
      groups.push({ key, label: formatDayHeader(entry.createdAt), items: [entry] })
    }
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">{group.label}</p>
          <div className="relative pl-4">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            <ul className="space-y-3">
              {group.items.map((entry, index) => {
                const actorName = entry.user?.nama ?? entry.userId ?? 'Tidak diketahui'
                const isOngoing = entry.closedAt === null || entry.closedAt === undefined
                const summary = entry.keterangan ?? BAGIAN_LABEL[entry.bagian]
                const count = entry.meta?.count ?? 1
                return (
                  <li key={entry.id} className="relative flex gap-3">
                    <span
                      className={`absolute -left-[13px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                        index === 0 ? 'bg-blue-500' : 'bg-surface-strong'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 gap-y-0.5">
                        <Badge
                          variant="outline"
                          className={`min-h-6 px-2 py-0.5 text-xs ${BAGIAN_BADGE_CLASS[entry.bagian]}`}
                        >
                          {BAGIAN_LABEL[entry.bagian]}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTime(entry.createdAt)}
                        </span>
                        {isOngoing ? (
                          <span className="inline-flex min-h-6 items-center rounded-md border border-amber-500 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                            berlangsung
                          </span>
                        ) : null}
                        {!isOngoing && count > 1 ? (
                          <span className="text-[10px] text-muted-foreground">{count} perubahan</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-secondary-foreground mt-0.5">{actorName}</p>
                      <p className="text-[11px] text-secondary-foreground mt-1">{summary}</p>
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
