import { createFileRoute } from '@tanstack/react-router'
import { ManajemenOPD } from '@/pages/pj-evaluator/opd/ManajemenOPD'

export const Route = createFileRoute('/pj-evaluator/opd/')({
  component: ManajemenOPD,
})
