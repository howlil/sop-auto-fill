import { Building2, CalendarDays, FileText, UserRoundCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useSopEditor } from '../SopEditorContext'

function displayTitle(metadata: ReturnType<typeof useSopEditor>['metadata']) {
  return metadata.nama ?? metadata.judul ?? metadata.name ?? ''
}

function displayNumber(metadata: ReturnType<typeof useSopEditor>['metadata']) {
  return metadata.nomorSOP ?? metadata.nomor ?? metadata.number ?? ''
}

function institutionText(metadata: ReturnType<typeof useSopEditor>['metadata']) {
  if (metadata.institutionLines && metadata.institutionLines.length > 0) {
    return metadata.institutionLines.join('\n')
  }
  return metadata.lembaga ?? ''
}

function FieldShell({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {hint ? <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  )
}

export function SopBasicInfoSection() {
  const { metadata, handleMetadataChange, isReadOnly } = useSopEditor()
  const title = displayTitle(metadata)
  const number = displayNumber(metadata)
  const institution = institutionText(metadata)

  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="mb-7">
        <div className="flex items-center gap-2 text-primary">
          <FileText className="h-5 w-5" />
          <span className="text-sm font-semibold">Langkah 1</span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Informasi Dasar</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Isi identitas utama dokumen. Informasi pendukung seperti dasar hukum dan peringatan tersedia pada bagian berikutnya.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldShell label="Judul SOP" hint="wajib">
              <Textarea
                value={title}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                rows={2}
                placeholder="Contoh: SOP Verifikasi dan Evaluasi Dokumen"
                className="min-h-20 text-base"
                onChange={(event) => {
                  const value = event.target.value
                  handleMetadataChange('judul', value)
                  handleMetadataChange('nama', value)
                }}
              />
            </FieldShell>
          </div>

          <FieldShell label="Nomor SOP" hint="wajib">
            <Input
              value={number}
              readOnly={isReadOnly}
              disabled={isReadOnly}
              placeholder="Contoh: SOP-ORG-001"
              className="h-11"
              onChange={(event) => {
                const value = event.target.value
                handleMetadataChange('nomorSOP', value)
                handleMetadataChange('nomor', value)
              }}
            />
          </FieldShell>

          <div className="rounded-xl bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Nama lembaga akan tampil pada header dokumen final. Gunakan beberapa baris bila struktur unit perlu ditampilkan lengkap.
              </p>
            </div>
          </div>

          <div className="sm:col-span-2">
            <FieldShell label="Nama / detail lembaga">
              <Textarea
                value={institution}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                rows={4}
                placeholder={'Nama instansi\nUnit / biro\nPemerintah daerah'}
                className="min-h-28"
                onChange={(event) => {
                  const lines = event.target.value.split('\n')
                  handleMetadataChange('institutionLines', lines)
                  handleMetadataChange('lembaga', lines.join('\n'))
                }}
              />
            </FieldShell>
          </div>
        </div>

        <details className="group rounded-xl border border-border bg-background">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-medium text-foreground">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Detail dokumen tambahan
            </span>
            <span className="text-xs font-normal text-muted-foreground group-open:hidden">Tampilkan</span>
            <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Sembunyikan</span>
          </summary>
          <div className="grid gap-5 border-t border-border px-4 py-5 sm:grid-cols-2">
            <FieldShell label="Tanggal pembuatan">
              <Input
                type="date"
                value={(metadata.tanggalPembuatan ?? '').slice(0, 10)}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                className="h-11"
                onChange={(event) => handleMetadataChange('tanggalPembuatan', event.target.value)}
              />
            </FieldShell>
            <FieldShell label="Tanggal efektif">
              <Input
                type="date"
                value={(metadata.tanggalEfektif ?? '').slice(0, 10)}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                className="h-11"
                onChange={(event) => handleMetadataChange('tanggalEfektif', event.target.value)}
              />
            </FieldShell>
            <FieldShell label="Nama penanggung jawab">
              <Input
                value={metadata.picName ?? ''}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                className="h-11"
                placeholder="Nama pejabat / penanggung jawab"
                onChange={(event) => handleMetadataChange('picName', event.target.value)}
              />
            </FieldShell>
            <FieldShell label="NIP / identitas penanggung jawab">
              <Input
                value={metadata.picNumber ?? ''}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                className="h-11"
                placeholder="NIP atau nomor identitas"
                onChange={(event) => handleMetadataChange('picNumber', event.target.value)}
              />
            </FieldShell>
            <div className="sm:col-span-2 flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-3 text-xs leading-5 text-muted-foreground">
              <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Detail tambahan dapat dilengkapi kapan saja sebelum versi SOP diselesaikan.
            </div>
          </div>
        </details>
      </div>
    </section>
  )
}
