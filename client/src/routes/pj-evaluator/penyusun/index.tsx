import { createFileRoute } from '@tanstack/react-router'
import { ManajemenPenyusun } from '@/pages/pj-evaluator/penyusun/ManajemenPenyusun'

export const Route = createFileRoute('/pj-evaluator/penyusun/')({
  component: ManajemenPenyusun,
})
