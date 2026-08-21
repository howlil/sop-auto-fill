import { useState } from 'react'
import { ClipboardList, Link2, Package, Plus, Scale, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EditableStringList } from '@/components/ui/editable-string-list'
import { FieldWithCornerRemoveButton } from '@/components/ui/field-with-corner-remove-button'
import { LawBasisDialog } from './LawBasisDialog'
import { RelatedPosDialog } from './RelatedPosDialog'
import { useSopEditor } from '../SopEditorContext'

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.length > 0) return [value]
  return []
}

function SectionBlock({
  title,
  description,
  icon,
  action,
  children,
}: {
  title: string
  description: string
  icon: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-border py-6 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 text-muted-foreground">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4 sm:pl-8">{children}</div>
    </div>
  )
}

export function SopSupportingInfoSection() {
  const { metadata, handleMetadataChange, isReadOnly } = useSopEditor()
  const [isLawBasisOpen, setIsLawBasisOpen] = useState(false)
  const [isRelatedSopOpen, setIsRelatedSopOpen] = useState(false)

  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="mb-7">
        <div className="flex items-center gap-2 text-primary">
          <ClipboardList className="h-5 w-5" />
          <span className="text-sm font-semibold">Langkah 4</span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Informasi Pendukung</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Lengkapi acuan, peringatan, kebutuhan, dan pencatatan yang mendukung pelaksanaan SOP.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-background px-5 sm:px-6">
        <SectionBlock
          title="Dasar hukum"
          description="Peraturan atau dasar formal yang menjadi acuan dokumen."
          icon={<Scale className="h-5 w-5" />}
          action={!isReadOnly ? (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setIsLawBasisOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          ) : undefined}
        >
          {(metadata.lawBasis ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada dasar hukum.</p>
          ) : (
            <div className="space-y-2">
              {(metadata.lawBasis ?? []).map((item, index) => (
                isReadOnly ? (
                  <p key={`${item}-${index}`} className="text-sm text-secondary-foreground">• {item}</p>
                ) : (
                  <FieldWithCornerRemoveButton
                    key={`${item}-${index}`}
                    className="rounded-lg border border-border bg-muted/30"
                    contentClassName="px-3 py-2.5 pr-9 text-sm text-secondary-foreground"
                    onRemove={() => {
                      handleMetadataChange('lawBasis', (metadata.lawBasis ?? []).filter((_, i) => i !== index))
                      handleMetadataChange('lawBasisIds', (metadata.lawBasisIds ?? []).filter((_, i) => i !== index))
                    }}
                  >
                    {item}
                  </FieldWithCornerRemoveButton>
                )
              ))}
            </div>
          )}
        </SectionBlock>

        <SectionBlock
          title="Keterkaitan SOP"
          description="Dokumen SOP lain yang menjadi input, lanjutan, atau memiliki hubungan proses."
          icon={<Link2 className="h-5 w-5" />}
          action={!isReadOnly ? (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setIsRelatedSopOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          ) : undefined}
        >
          {(metadata.relatedSop ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada SOP terkait.</p>
          ) : (
            <div className="space-y-2">
              {(metadata.relatedSop ?? []).map((item, index) => (
                isReadOnly ? (
                  <p key={`${item}-${index}`} className="text-sm text-secondary-foreground">• {item}</p>
                ) : (
                  <FieldWithCornerRemoveButton
                    key={`${item}-${index}`}
                    className="rounded-lg border border-border bg-muted/30"
                    contentClassName="px-3 py-2.5 pr-9 text-sm text-secondary-foreground"
                    onRemove={() => {
                      handleMetadataChange('relatedSop', (metadata.relatedSop ?? []).filter((_, i) => i !== index))
                      handleMetadataChange('relatedSopDetailIds', (metadata.relatedSopDetailIds ?? []).filter((_, i) => i !== index))
                    }}
                  >
                    {item}
                  </FieldWithCornerRemoveButton>
                )
              ))}
            </div>
          )}
        </SectionBlock>

        <SectionBlock
          title="Peringatan"
          description="Hal penting yang harus diperhatikan untuk mencegah kesalahan pelaksanaan."
          icon={<ShieldAlert className="h-5 w-5" />}
          action={!isReadOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => handleMetadataChange('warning', [...asArray(metadata.warning), ''])}
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          ) : undefined}
        >
          {isReadOnly ? (
            asArray(metadata.warning).length > 0 ? (
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-secondary-foreground">
                {asArray(metadata.warning).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Tidak ada peringatan.</p>
          ) : (
            <EditableStringList
              items={asArray(metadata.warning)}
              onChange={(next) => handleMetadataChange('warning', next)}
              placeholder="Tuliskan peringatan"
              emptyMessage="Belum ada peringatan."
              showAddButton={false}
            />
          )}
        </SectionBlock>

        <SectionBlock
          title="Kualifikasi pelaksana"
          description="Kompetensi atau persyaratan yang dibutuhkan oleh pelaksana SOP."
          icon={<ClipboardList className="h-5 w-5" />}
          action={!isReadOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => handleMetadataChange('implementQualification', [...asArray(metadata.implementQualification), ''])}
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          ) : undefined}
        >
          {isReadOnly ? (
            asArray(metadata.implementQualification).length > 0 ? (
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-secondary-foreground">
                {asArray(metadata.implementQualification).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Belum ada kualifikasi.</p>
          ) : (
            <EditableStringList
              items={asArray(metadata.implementQualification)}
              onChange={(next) => handleMetadataChange('implementQualification', next)}
              placeholder="Tuliskan kualifikasi"
              emptyMessage="Belum ada kualifikasi."
              showAddButton={false}
            />
          )}
        </SectionBlock>

        <SectionBlock
          title="Peralatan dan perlengkapan"
          description="Alat, dokumen, sistem, atau sarana yang diperlukan selama proses."
          icon={<Package className="h-5 w-5" />}
          action={!isReadOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => handleMetadataChange('equipment', [...asArray(metadata.equipment), ''])}
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          ) : undefined}
        >
          {isReadOnly ? (
            asArray(metadata.equipment).length > 0 ? (
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-secondary-foreground">
                {asArray(metadata.equipment).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Belum ada peralatan/perlengkapan.</p>
          ) : (
            <EditableStringList
              items={asArray(metadata.equipment)}
              onChange={(next) => handleMetadataChange('equipment', next)}
              placeholder="Tuliskan peralatan atau perlengkapan"
              emptyMessage="Belum ada peralatan/perlengkapan."
              showAddButton={false}
            />
          )}
        </SectionBlock>

        <SectionBlock
          title="Pencatatan dan pendataan"
          description="Catatan, bukti, atau output administrasi yang harus disimpan dari pelaksanaan SOP."
          icon={<ClipboardList className="h-5 w-5" />}
          action={!isReadOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => handleMetadataChange('recordData', [...asArray(metadata.recordData), ''])}
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          ) : undefined}
        >
          {isReadOnly ? (
            asArray(metadata.recordData).length > 0 ? (
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-secondary-foreground">
                {asArray(metadata.recordData).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Belum ada pencatatan/pendataan.</p>
          ) : (
            <EditableStringList
              items={asArray(metadata.recordData)}
              onChange={(next) => handleMetadataChange('recordData', next)}
              placeholder="Tuliskan pencatatan atau pendataan"
              emptyMessage="Belum ada pencatatan/pendataan."
              showAddButton={false}
            />
          )}
        </SectionBlock>
      </div>

      {!isReadOnly ? (
        <>
          <LawBasisDialog
            open={isLawBasisOpen}
            onOpenChange={setIsLawBasisOpen}
            onAdd={({ ids, labels }) => {
              handleMetadataChange('lawBasis', labels)
              handleMetadataChange('lawBasisIds', ids)
            }}
          />
          <RelatedPosDialog
            open={isRelatedSopOpen}
            onOpenChange={setIsRelatedSopOpen}
            onAdd={({ ids, labels }) => {
              handleMetadataChange('relatedSop', labels)
              handleMetadataChange('relatedSopDetailIds', ids)
            }}
          />
        </>
      ) : null}
    </section>
  )
}
