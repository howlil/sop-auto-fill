import { createFileRoute } from '@tanstack/react-router'
import { DetailSOPPenyusun } from '@/pages/penyusun/sop/detail/DetailSOPPenyusun'

export const Route = createFileRoute('/workspaces/$workspaceId/sops/$sopId')({
  component: DetailSOPPenyusun,
})
