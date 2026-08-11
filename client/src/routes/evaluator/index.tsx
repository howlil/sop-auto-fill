import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROUTES } from '@/utils/constants'

export const Route = createFileRoute('/evaluator/')({
  beforeLoad: () => {
    throw redirect({ to: ROUTES.EVALUATOR.EVALUASI })
  },
  component: RedirectPlaceholder,
})

function RedirectPlaceholder() {
  return null
}
