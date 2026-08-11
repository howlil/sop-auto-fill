import { createFileRoute } from '@tanstack/react-router'
import { ManajemenEvaluator } from '@/pages/pj-evaluator/evaluator/ManajemenEvaluator'

export const Route = createFileRoute('/pj-evaluator/evaluator/')({
  component: ManajemenEvaluator,
})
