import { createFileRoute } from '@tanstack/react-router'
import { ManajemenEvaluasiSop } from '@/pages/pj-evaluator/evaluasi/ManajemenEvaluasiSop'

export const Route = createFileRoute('/pj-evaluator/evaluasi/')({
  component: ManajemenEvaluasiSop,
})
