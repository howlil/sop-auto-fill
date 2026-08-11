import {
  BeritaAcaraTemplate,
  type BeritaAcaraTemplateProps,
} from '@/components/pengajuan/berita-acara-template'
import { LoadingState } from '@/components/ui/loading-state'

export interface BeritaAcaraPreviewPaneProps {
  isLoading: boolean
  templateProps: BeritaAcaraTemplateProps
  loadingMessage?: string
}

export function BeritaAcaraPreviewPane({
  isLoading,
  templateProps,
  loadingMessage = 'Memuat Berita Acara...',
}: BeritaAcaraPreviewPaneProps) {
  if (isLoading) {
    return <LoadingState className="min-h-64" message={loadingMessage} />
  }
  return (
    <div className="flex w-full justify-center">
      <BeritaAcaraTemplate {...templateProps} forPrint />
    </div>
  )
}
