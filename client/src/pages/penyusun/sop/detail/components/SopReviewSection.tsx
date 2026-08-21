import { CheckCircle2, CircleAlert, ClipboardCheck, History, Activity, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AiSopQualityReviewPanel, type AiSopQualityReviewPanelProps } from './AiSopQualityReviewPanel'
import { RiwayatVersiPanel } from '@/pages/penyusun/sop/components/RiwayatVersiPanel'
import { RiwayatStatusPanel } from '@/pages/penyusun/sop/components/RiwayatStatusPanel'
import { validateProsedurRows } from '@/lib/sop/validateProsedurRows'
import { useSopEditor } from '../SopEditorContext'
import type { PenyusunWorkbenchLogEdit, SopRiwayatVersiRow } from '@/types/dto/sop.dto'
import type { SopHeaderAutosaveStatus } from '@/pages/penyusun/sop/hooks/use-sop-header-autosave'
import { useState } from 'react'

function titleValue(metadata: ReturnType<typeof useSopEditor>['metadata']) {
  return (metadata.nama ?? metadata.judul ?? metadata.name ?? '').trim()
}

function numberValue(metadata: ReturnType<typeof useSopEditor>['metadata']) {
  return (metadata.nomorSOP ?? metadata.nomor ?? metadata.number ?? '').trim()
}

export function SopReviewSection({
  workspaceId,
  sopId,
  detailSopId,
  aiReviewPanelProps,
  auditEntries,
  combinedAutosaveStatus,
  onComplete,
  canBuatVersiBaru,
  onBuatVersiBaru,
  isBuatVersiBaruPending,
}: {
  workspaceId: string
  sopId: string
  detailSopId?: string
  aiReviewPanelProps: AiSopQualityReviewPanelProps
  auditEntries: PenyusunWorkbenchLogEdit[]
  combinedAutosaveStatus: SopHeaderAutosaveStatus
  onComplete: () => void
  canBuatVersiBaru: boolean
  onBuatVersiBaru: (source?: SopRiwayatVersiRow) => void
  isBuatVersiBaruPending: boolean
}) {
  const { metadata, implementers, prosedurRows, isReadOnly } = useSopEditor()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const validation = validateProsedurRows(prosedurRows, implementers.length)

  const checks = [
    {
      label: 'Judul dan nomor SOP terisi',
      done: titleValue(metadata).length > 0 && numberValue(metadata).length > 0,
    },
    {
      label: 'Minimal satu pelaksana tersedia',
      done: implementers.length > 0,
    },
    {
      label: 'Prosedur memiliki struktur yang valid',
      done: validation.valid,
    },
    {
      label: 'Semua perubahan tersimpan',
      done: combinedAutosaveStatus !== 'error' && combinedAutosaveStatus !== 'saving' && combinedAutosaveStatus !== 'pending',
    },
  ]
  const readyToComplete = checks.every((check) => check.done)

  return (
    <section className="mx-auto w-full max-w-4xl">
      <div className="mb-7">
        <div className="flex items-center gap-2 text-primary">
          <ClipboardCheck className="h-5 w-5" />
          <span className="text-sm font-semibold">Langkah 5</span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Review</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Periksa kesiapan dokumen, tindak lanjuti temuan penting, lalu selesaikan versi ketika isinya sudah final.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.78fr)]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Kesiapan dokumen</h3>
                <p className="mt-1 text-sm text-muted-foreground">Pemeriksaan ini bersifat deterministik dan tidak bergantung pada AI.</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${readyToComplete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {checks.filter((check) => check.done).length}/{checks.length} siap
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {checks.map((check) => (
                <li key={check.label} className="flex items-start gap-3 text-sm">
                  {check.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <span className={check.done ? 'text-secondary-foreground' : 'font-medium text-foreground'}>{check.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {!isReadOnly ? (
            <AiSopQualityReviewPanel {...aiReviewPanelProps} />
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex gap-3">
                <LockKeyhole className="mt-0.5 h-5 w-5 text-emerald-700" />
                <div>
                  <h3 className="font-semibold text-emerald-900">Versi ini sudah selesai dan dikunci</h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-800">
                    Konten tidak dapat diubah langsung. Buat versi baru untuk melanjutkan penyuntingan tanpa mengubah riwayat versi ini.
                  </p>
                  {canBuatVersiBaru ? (
                    <Button className="mt-4" onClick={() => onBuatVersiBaru()} disabled={isBuatVersiBaruPending}>
                      {isBuatVersiBaruPending ? 'Membuat versi…' : 'Buat versi baru'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          {!isReadOnly ? (
            <div className="rounded-2xl border border-border bg-background p-5">
              <h3 className="text-base font-semibold text-foreground">Selesaikan versi</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Setelah selesai, versi aktif menjadi read-only. Perubahan berikutnya dilakukan melalui versi baru.
              </p>
              <Button
                type="button"
                className="mt-4 w-full"
                disabled={!readyToComplete}
                onClick={() => setIsConfirmOpen(true)}
              >
                Complete versi {metadata.version ?? 1}
              </Button>
              {!readyToComplete ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Selesaikan item kesiapan di sebelah kiri sebelum mengunci versi.
                </p>
              ) : null}
            </div>
          ) : null}

          <details className="rounded-2xl border border-border bg-background">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-sm font-semibold text-foreground">
              <History className="h-4 w-4 text-muted-foreground" /> Riwayat versi
            </summary>
            <div className="border-t border-border">
              <RiwayatVersiPanel
                workspaceId={workspaceId}
                sopId={sopId}
                activeDetailSopId={detailSopId}
                isReadOnly={isReadOnly}
                onBuatVersiBaru={onBuatVersiBaru}
                isBuatVersiBaruPending={isBuatVersiBaruPending}
              />
            </div>
          </details>

          <details className="rounded-2xl border border-border bg-background">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-sm font-semibold text-foreground">
              <Activity className="h-4 w-4 text-muted-foreground" /> Aktivitas
            </summary>
            <div className="border-t border-border p-3">
              <RiwayatStatusPanel entries={auditEntries} />
            </div>
          </details>
        </aside>
      </div>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Complete versi SOP?"
        description="Versi aktif akan dikunci dan tidak dapat diedit langsung. Jika perlu mengubah isi setelah ini, buat versi baru yang menyalin seluruh konten versi ini."
        confirmLabel={`Complete versi ${metadata.version ?? 1}`}
        cancelLabel="Kembali"
        onConfirm={() => {
          setIsConfirmOpen(false)
          onComplete()
        }}
      />
    </section>
  )
}
