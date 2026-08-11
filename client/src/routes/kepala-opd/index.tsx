import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROUTES } from '@/utils/constants'

export const Route = createFileRoute('/kepala-opd/')({
  beforeLoad: () => {
    throw redirect({ to: ROUTES.KEPALA_OPD.SOP })
  },
  component: RedirectPlaceholder,
})

function RedirectPlaceholder() {
  return null
}
