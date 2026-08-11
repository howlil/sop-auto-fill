import { createFileRoute, Outlet } from '@tanstack/react-router'
import { RouteErrorPage } from '@/components/ui/route-error'

export const Route = createFileRoute('/evaluator/evaluasi')({
  component: EvaluatorEvaluasiLayout,
  errorComponent: ({ error, reset }) => <RouteErrorPage error={error} reset={reset} />,
})

function EvaluatorEvaluasiLayout() {
  return <Outlet />
}
