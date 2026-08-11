import { createFileRoute } from '@tanstack/react-router'
import { DetailSOPPenyusun } from '@/pages/penyusun/sop/detail/DetailSOPPenyusun'

export const Route = createFileRoute('/penyusun/sop/$id')({
  component: DetailSOPPenyusun,
})
