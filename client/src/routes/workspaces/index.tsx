import { createFileRoute } from '@tanstack/react-router'
import { WorkspacesPage } from '@/pages/workspaces/WorkspacesPage'

export const Route = createFileRoute('/workspaces/')({
  component: WorkspacesPage,
})
