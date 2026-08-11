import { createFileRoute, Navigate } from '@tanstack/react-router'
import { ROUTES } from '@/utils/constants'

export const Route = createFileRoute('/pj-evaluator/')({
  component: PjEvaluatorIndex,
})

function PjEvaluatorIndex() {
  return <Navigate to={ROUTES.PJ_EVALUATOR.GRAFIK_EVALUASI} />
}
