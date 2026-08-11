import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteErrorPage } from '@/components/ui/route-error'
import { requireRoles } from '@/stores/authStore'

export const Route = createFileRoute('/penyusun')({
  // Protected dashboards hydrate auth from browser storage + HttpOnly cookie.
  // Rendering them on the Start server would execute authenticated queries without the user's cookie.
  ssr: false,
  beforeLoad: requireRoles(['PENYUSUN', 'PJ_PENYUSUN']),
  component: DashboardLayout,
  errorComponent: ({ error, reset }) => <RouteErrorPage error={error} reset={reset} />,
})