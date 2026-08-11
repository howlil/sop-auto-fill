import { useState } from 'react'
import { SOPHeaderSection } from './SOPHeaderSection'
import { LawBasisDialog } from './LawBasisDialog'
import { RelatedPosDialog } from './RelatedPosDialog'
import { PelaksanaDialog } from './PelaksanaDialog'
import { useSopEditor } from '../SopEditorContext'

/**
 * Panel kanan editor SOP. Tidak menerima props metadata/implementers lagi —
 * semua dibaca dari `useSopEditor()`. Komponen ini hanya bertanggung jawab atas
 * UI state lokal (open/close dialog) dan komposisi child.
 */
export function DetailSOPMetadataPanel() {
  const {
    handleMetadataChange,
    implementers,
    setImplementers,
    masterPelaksanaOptions,
    isReadOnly,
  } = useSopEditor()
  const [isLawBasisOpen, setIsLawBasisOpen] = useState(false)
  const [isRelatedPosOpen, setIsRelatedPosOpen] = useState(false)
  const [isPelaksanaDialogOpen, setIsPelaksanaDialogOpen] = useState(false)

  return (
    <>
      <div className="space-y-3 bg-surface-subtle/80 p-2">
        <SOPHeaderSection
          onOpenLawBasisDialog={() => setIsLawBasisOpen(true)}
          onOpenRelatedPosDialog={() => setIsRelatedPosOpen(true)}
          onOpenPelaksanaDialog={() => setIsPelaksanaDialogOpen(true)}
        />
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
        open={isRelatedPosOpen}
        onOpenChange={setIsRelatedPosOpen}
        onAdd={({ ids, labels }) => {
          handleMetadataChange('relatedSop', labels)
          handleMetadataChange('relatedSopDetailIds', ids)
        }}
      />

      {masterPelaksanaOptions.length > 0 ? (
        <PelaksanaDialog
          open={isPelaksanaDialogOpen}
          onOpenChange={setIsPelaksanaDialogOpen}
          options={masterPelaksanaOptions}
          existingImplementers={implementers}
          onAdd={(fullList) => setImplementers(fullList)}
        />
      ) : null}
        </>
      ) : null}
    </>
  )
}
