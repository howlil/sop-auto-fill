import { createFileRoute } from '@tanstack/react-router'
import { WorkspaceDetailPage } from '@/pages/workspaces/WorkspaceDetailPage'

export const Route = createFileRoute('/workspaces/$workspaceId/')({
  component: WorkspaceRoutePage,
})

function WorkspaceRoutePage() {
  const { workspaceId } = Route.useParams()
  return <WorkspaceDetailPage workspaceId={workspaceId} />
}
