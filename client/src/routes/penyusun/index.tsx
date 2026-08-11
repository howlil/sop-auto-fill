import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROUTES } from '@/utils/constants'

export const Route = createFileRoute('/penyusun/')({
  beforeLoad: () => {
    throw redirect({ to: ROUTES.PENYUSUN.SOP })
  },
  component: RedirectPlaceholder,
})

function RedirectPlaceholder() {
  return null
}
