/**

 * Timeline component for evaluation history (riwayat evaluasi).

 * Displays audit trail from LogNilaiEvaluasi.

 */

import { History, MessageSquare } from "lucide-react"

import { formatDateId } from "@/utils/format-date"

import type { LogNilaiEvaluasi } from "@/types/dto/evaluasi.dto"
import { HasilEvaluasiBadge } from "@/components/status/hasil-evaluasi-badge"
import { EmptyState } from "@/components/ui/empty-state"



export interface RiwayatEvaluasiTimelineProps {

  logs: LogNilaiEvaluasi[]

  className?: string

}



function HasilBadge({ hasil }: { hasil?: string | null }) {

  if (!hasil) return <span className="text-muted-foreground text-xs">Belum dinilai</span>

  const label =
    hasil === "SESUAI"
      ? "Sesuai"
      : hasil === "PERLU_PERBAIKAN"
        ? "Perlu Perbaikan"
        : hasil

  return <HasilEvaluasiBadge hasil={hasil} label={label} showDomain={false} />

}



export function RiwayatEvaluasiTimeline({ logs, className = "" }: RiwayatEvaluasiTimelineProps) {

  if (logs.length === 0) {

    return (

      <EmptyState
        icon={<History />}
        title="Belum ada riwayat evaluasi"
        description="Perubahan hasil evaluasi akan tercatat di sini."
        className="min-h-0 py-8"
      />

    )

  }



  return (

    <div className={`space-y-2 ${className}`}>

      {logs.map((log) => {

        const hasPerubahanHasil =

          (log.hasilSebelum ?? null) !== (log.hasilSesudah ?? null)

        return (

          <div

            key={log.id}

            className="relative space-y-1.5 rounded-lg border border-border bg-surface-subtle p-2.5 shadow-surface"

          >

            <div className="flex items-center justify-between gap-2">

              <div className="flex items-center gap-2">

                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-subtle">

                  <span className="text-[10px] font-semibold text-primary">

                    {log.evaluatorNama?.charAt(0) ?? "E"}

                  </span>

                </div>

                <div>

                  <p className="text-xs font-medium text-foreground">{log.evaluatorNama ?? "Evaluator"}</p>

                  <p className="text-[10px] text-muted-foreground">{formatDateId(log.createdAt)}</p>

                </div>

              </div>

              {!hasPerubahanHasil ? (

                <div className="flex items-center gap-1">

                  <HasilBadge hasil={log.hasilSesudah} />

                </div>

              ) : null}

            </div>



            {hasPerubahanHasil ? (

              <div className="flex flex-wrap items-center gap-2 text-[11px]">

                <span className="text-muted-foreground">Perubahan:</span>

                <HasilBadge hasil={log.hasilSebelum} />

                <span className="text-muted-foreground">→</span>

                <HasilBadge hasil={log.hasilSesudah} />

              </div>

            ) : null}



            {log.catatanSesudah ? (

              <div className="flex items-start gap-1.5 rounded border border-border bg-surface p-1.5 text-xs text-secondary-foreground">

                <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />

                <p className="whitespace-pre-wrap">{log.catatanSesudah}</p>

              </div>

            ) : null}

          </div>

        )

      })}

    </div>

  )

}


