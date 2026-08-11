import type { ReactNode } from 'react'
import { Building2, ClipboardList, FileText, Hash, Link2, Package, Scale, ShieldAlert, Users } from 'lucide-react'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Textarea } from '@/components/ui/textarea'
import { AddItemIconButton, EditableStringList } from '@/components/ui/editable-string-list'
import { FieldWithCornerRemoveButton } from '@/components/ui/field-with-corner-remove-button'
import type { SOPDetailMetadata } from '@/types/ui/sop'
import { cn } from '@/utils/cn'
import { useSopEditor } from '../SopEditorContext'

/** Memecah teks jadi array baris; baris kosong dipertahankan agar Enter = baris baru. */
function toLinesKeepEmpty(value: string): string[] {
  return value.split('\n')
}

/** Sama seperti panel utama / `toPreviewMetadata`: judul & nomor dari field API. */
function metadataDisplayName(meta: SOPDetailMetadata): string {
  return meta.nama ?? meta.judul ?? meta.name ?? ''
}

function metadataDisplayNumber(meta: SOPDetailMetadata): string {
  return meta.nomorSOP ?? meta.nomor ?? meta.number ?? ''
}

/** Tampilan textarea lembaga: baris terstruktur atau teks `lembaga` mentah. */
function metadataInstitutionTextareaValue(meta: SOPDetailMetadata): string {
  if (meta.institutionLines !== undefined && meta.institutionLines.length > 0) {
    return meta.institutionLines.join('\n')
  }
  return meta.lembaga ?? ''
}

function asArray(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string' && v.length > 0) return [v]
  return []
}

function MetadataFieldCard({
  icon,
  title,
  subtitle,
  children,
  action,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-surface">
      <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-foreground">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="space-y-3 px-3 py-3">{children}</div>
    </section>
  )
}

function ReadOnlyTextBlock({
  value,
  placeholder,
  multiline = false,
}: {
  value: string
  placeholder: string
  multiline?: boolean
}) {
  const hasValue = value.trim().length > 0
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface-subtle px-3 py-2 text-xs text-foreground',
        multiline ? 'whitespace-pre-wrap leading-relaxed min-h-[84px]' : 'min-h-9 flex items-center',
      )}
    >
      {hasValue ? value : <span className="text-muted-foreground">{placeholder}</span>}
    </div>
  )
}

export interface SOPHeaderSectionProps {
  onOpenLawBasisDialog: () => void
  onOpenRelatedPosDialog: () => void
  onOpenPelaksanaDialog?: () => void
}

/**
 * Form input header SOP. Mengonsumsi state metadata/implementers dari `useSopEditor()`.
 * Hanya menerima props untuk membuka dialog (state UI lokal milik panel).
 */
export function SOPHeaderSection({
  onOpenLawBasisDialog,
  onOpenRelatedPosDialog,
  onOpenPelaksanaDialog,
}: SOPHeaderSectionProps) {
  const { metadata, handleMetadataChange, implementers, setImplementers, isReadOnly } =
    useSopEditor()

  const roInput = isReadOnly ? 'cursor-default bg-surface-subtle text-foreground' : ''
  const institutionText = metadataInstitutionTextareaValue(metadata)
  const sopName = metadataDisplayName(metadata)
  const sopNumber = metadataDisplayNumber(metadata)

  return (
    <div className="space-y-3">

      <MetadataFieldCard
        icon={<Building2 className="h-3.5 w-3.5" />}
        title="Nama/Detail lembaga"
        subtitle="Empat baris identitas lembaga pada header dokumen."
      >
        {isReadOnly ? (
          <ReadOnlyTextBlock
            value={institutionText}
            placeholder="Belum diisi."
            multiline
          />
        ) : (
          <Textarea
            className={cn('text-xs min-h-[84px]', roInput)}
            readOnly={isReadOnly}
            disabled={isReadOnly}
            value={institutionText}
            onChange={(e) => {
              const lines = toLinesKeepEmpty(e.target.value)
              handleMetadataChange('institutionLines', lines)
              handleMetadataChange('lembaga', lines.join('\n'))
            }}
            placeholder="Baris 1&#10;Baris 2&#10;Baris 3&#10;Baris 4"
          />
        )}
      </MetadataFieldCard>

      <MetadataFieldCard
        icon={<FileText className="h-3.5 w-3.5" />}
        title="Identitas SOP"
        subtitle="Judul dan nomor dokumen SOP."
      >
        <FormField label={<span className="font-medium text-foreground">Nama SOP</span>}>
          {isReadOnly ? (
            <ReadOnlyTextBlock value={sopName} placeholder="Belum ada nama SOP." />
          ) : (
            <AutoResizeTextarea
              className={cn('text-xs min-h-9 py-1.5', roInput)}
              minRows={1}
              maxRows={8}
              readOnly={isReadOnly}
              disabled={isReadOnly}
              value={sopName}
              onChange={(e) => {
                const v = e.target.value
                handleMetadataChange('judul', v)
                handleMetadataChange('nama', v)
              }}
              placeholder="Judul SOP"
            />
          )}
        </FormField>
        <FormField label={<span className="font-medium text-foreground">Nomor SOP</span>}>
          {isReadOnly ? (
            <ReadOnlyTextBlock value={sopNumber} placeholder="Belum ada nomor SOP." />
          ) : (
            <Input
              className={cn('h-9 text-xs', roInput)}
              readOnly={isReadOnly}
              disabled={isReadOnly}
              value={sopNumber}
              onChange={(e) => {
                const v = e.target.value
                handleMetadataChange('nomorSOP', v)
                handleMetadataChange('nomor', v)
              }}
              placeholder="Mis. 001/SOP/2026"
            />
          )}
        </FormField>
      </MetadataFieldCard>

      <MetadataFieldCard
        icon={<Scale className="h-3.5 w-3.5" />}
        title="Dasar hukum"
        subtitle="Peraturan atau dasar hukum yang menjadi acuan SOP."
        action={
          !isReadOnly ? (
            <AddItemIconButton onClick={onOpenLawBasisDialog} label="Tambah dasar hukum" />
          ) : undefined
        }
      >
        <div className="space-y-1">
          {(metadata.lawBasis ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada dasar hukum.</p>
          ) : (
            (metadata.lawBasis ?? []).map((item: string, idx: number) =>
              !isReadOnly ? (
                <FieldWithCornerRemoveButton
                  key={`${idx}-${item}`}
                  className="rounded-md border border-border bg-surface-subtle"
                  contentClassName="px-3 py-2 pr-8 text-xs text-secondary-foreground"
                  onRemove={() => {
                    const nextLabels = (metadata.lawBasis ?? []).filter((_, i) => i !== idx)
                    const nextIds = (metadata.lawBasisIds ?? []).filter((_, i) => i !== idx)
                    handleMetadataChange('lawBasis', nextLabels)
                    handleMetadataChange('lawBasisIds', nextIds)
                  }}
                >
                  • {item}
                </FieldWithCornerRemoveButton>
              ) : (
                <p key={`${idx}-${item}`} className="text-xs text-secondary-foreground">
                  • {item}
                </p>
              ),
            )
          )}
        </div>
      </MetadataFieldCard>

      <MetadataFieldCard
        icon={<Link2 className="h-3.5 w-3.5" />}
        title="Keterkaitan dengan SOP"
        subtitle="SOP lain yang terkait dengan prosedur ini."
        action={
          !isReadOnly ? (
            <AddItemIconButton onClick={onOpenRelatedPosDialog} label="Tambah keterkaitan SOP" />
          ) : undefined
        }
      >
        <div className="space-y-1">
          {(metadata.relatedSop ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada keterkaitan SOP.</p>
          ) : (
            (metadata.relatedSop ?? []).map((item: string, idx: number) =>
              !isReadOnly ? (
                <FieldWithCornerRemoveButton
                  key={`${idx}-${item}`}
                  className="rounded-md border border-border bg-surface-subtle"
                  contentClassName="px-3 py-2 pr-8 text-xs text-secondary-foreground"
                  onRemove={() => {
                    const nextLabels = (metadata.relatedSop ?? []).filter((_, i) => i !== idx)
                    const nextIds = (metadata.relatedSopDetailIds ?? []).filter((_, i) => i !== idx)
                    handleMetadataChange('relatedSop', nextLabels)
                    handleMetadataChange('relatedSopDetailIds', nextIds)
                  }}
                >
                  • {item}
                </FieldWithCornerRemoveButton>
              ) : (
                <p key={`${idx}-${item}`} className="text-xs text-secondary-foreground">
                  • {item}
                </p>
              ),
            )
          )}
        </div>
      </MetadataFieldCard>

      <MetadataFieldCard
        icon={<Hash className="h-3.5 w-3.5" />}
        title="Peringatan"
        subtitle="Hal-hal yang perlu diperhatikan saat pelaksanaan."
        action={
          !isReadOnly ? (
            <AddItemIconButton
              onClick={() =>
                handleMetadataChange('warning', [...asArray(metadata.warning), ''])
              }
              label="Tambah peringatan"
            />
          ) : undefined
        }
      >
        {isReadOnly ? (
          <ul className="space-y-1 list-disc pl-4">
            {asArray(metadata.warning).length === 0 ? (
              <li className="text-xs text-muted-foreground">Tidak ada peringatan.</li>
            ) : (
              asArray(metadata.warning).map((line, idx) => (
                <li key={`${idx}-${line}`} className="text-xs text-secondary-foreground">
                  {line}
                </li>
              ))
            )}
          </ul>
        ) : (
          <EditableStringList
            items={asArray(metadata.warning)}
            onChange={(next) => handleMetadataChange('warning', next)}
            placeholder="Peringatan"
            emptyMessage="Belum ada peringatan."
            showAddButton={false}
          />
        )}
      </MetadataFieldCard>

      <MetadataFieldCard
        icon={<Hash className="h-3.5 w-3.5" />}
        title="Kualifikasi pelaksanaan"
        subtitle="Persyaratan kompetensi pelaksana SOP."
        action={
          !isReadOnly ? (
            <AddItemIconButton
              onClick={() =>
                handleMetadataChange('implementQualification', [
                  ...asArray(metadata.implementQualification),
                  '',
                ])
              }
              label="Tambah kualifikasi"
            />
          ) : undefined
        }
      >
        {isReadOnly ? (
          <ul className="space-y-1 list-disc pl-4">
            {asArray(metadata.implementQualification).length === 0 ? (
              <li className="text-xs text-muted-foreground">Belum ada kualifikasi.</li>
            ) : (
              asArray(metadata.implementQualification).map((line, idx) => (
                <li key={`${idx}-${line}`} className="text-xs text-secondary-foreground">
                  {line}
                </li>
              ))
            )}
          </ul>
        ) : (
          <EditableStringList
            items={asArray(metadata.implementQualification)}
            onChange={(next) => handleMetadataChange('implementQualification', next)}
            placeholder="Kualifikasi"
            emptyMessage="Belum ada kualifikasi."
            showAddButton={false}
          />
        )}
      </MetadataFieldCard>

      <MetadataFieldCard
        icon={<Package className="h-3.5 w-3.5" />}
        title="Peralatan dan perlengkapan"
        subtitle="Alat dan bahan yang dibutuhkan untuk pelaksanaan."
        action={
          !isReadOnly ? (
            <AddItemIconButton
              onClick={() =>
                handleMetadataChange('equipment', [...asArray(metadata.equipment), ''])
              }
              label="Tambah peralatan"
            />
          ) : undefined
        }
      >
        {isReadOnly ? (
          <ul className="space-y-1 list-disc pl-4">
            {asArray(metadata.equipment).length === 0 ? (
              <li className="text-xs text-muted-foreground">Belum ada peralatan/perlengkapan.</li>
            ) : (
              asArray(metadata.equipment).map((line, idx) => (
                <li key={`${idx}-${line}`} className="text-xs text-secondary-foreground">
                  {line}
                </li>
              ))
            )}
          </ul>
        ) : (
          <EditableStringList
            items={asArray(metadata.equipment)}
            onChange={(next) => handleMetadataChange('equipment', next)}
            placeholder="Peralatan"
            emptyMessage="Belum ada peralatan/perlengkapan."
            showAddButton={false}
          />
        )}
      </MetadataFieldCard>

      <MetadataFieldCard
        icon={<ClipboardList className="h-3.5 w-3.5" />}
        title="Pencatatan dan pendataan"
        subtitle="Dokumen atau catatan yang harus dibuat saat pelaksanaan."
        action={
          !isReadOnly ? (
            <AddItemIconButton
              onClick={() =>
                handleMetadataChange('recordData', [...asArray(metadata.recordData), ''])
              }
              label="Tambah pencatatan"
            />
          ) : undefined
        }
      >
        {isReadOnly ? (
          <ul className="space-y-1 list-disc pl-4">
            {asArray(metadata.recordData).length === 0 ? (
              <li className="text-xs text-muted-foreground">Belum ada pencatatan/pendataan.</li>
            ) : (
              asArray(metadata.recordData).map((line, idx) => (
                <li key={`${idx}-${line}`} className="text-xs text-secondary-foreground">
                  {line}
                </li>
              ))
            )}
          </ul>
        ) : (
          <EditableStringList
            items={asArray(metadata.recordData)}
            onChange={(next) => handleMetadataChange('recordData', next)}
            placeholder="Pencatatan"
            emptyMessage="Belum ada pencatatan/pendataan."
            showAddButton={false}
          />
        )}
      </MetadataFieldCard>

      <MetadataFieldCard
        icon={<Users className="h-3.5 w-3.5" />}
        title="Aktor pelaksana"
        subtitle="Daftar pelaksana yang terlibat pada SOP."
        action={
          !isReadOnly && onOpenPelaksanaDialog ? (
            <AddItemIconButton onClick={onOpenPelaksanaDialog} label="Tambah aktor pelaksana" />
          ) : undefined
        }
      >
        <div className="space-y-1">
          {implementers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada aktor pelaksana.</p>
          ) : (
            implementers.map((imp, idx) =>
              !isReadOnly ? (
                <FieldWithCornerRemoveButton
                  key={imp.id}
                  className="rounded-md border border-border bg-surface-subtle"
                  contentClassName="px-3 py-2 pr-8 text-xs text-secondary-foreground"
                  onRemove={() => setImplementers((prev) => prev.filter((_, i) => i !== idx))}
                >
                  • {imp.name}
                </FieldWithCornerRemoveButton>
              ) : (
                <p key={imp.id} className="text-xs text-secondary-foreground">
                  • {imp.name}
                </p>
              ),
            )
          )}
        </div>
      </MetadataFieldCard>

      {isReadOnly ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 text-amber-700" />
            <p className="text-[11px] leading-relaxed text-amber-800">
              Mode lihat aktif. Gunakan tab Edit pada dokumen yang dapat diubah untuk memperbarui metadata.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
