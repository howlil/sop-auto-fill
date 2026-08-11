import { createFileRoute } from '@tanstack/react-router'
import { DetailSOP } from '@/pages/kepala-opd/sop/DetailSOP'
import { ROUTES } from '@/utils/constants'

export const Route = createFileRoute('/kepala-opd/sop/$id')({
  component: KepalaOPDDetailSOPPage,
})

function KepalaOPDDetailSOPPage() {
  return (
    <DetailSOP
      breadcrumb={[
        { label: 'SOP', to: ROUTES.KEPALA_OPD.SOP },
        { label: 'Detail SOP' },
      ]}
      backTo={ROUTES.KEPALA_OPD.SOP}
    />
  )
}
