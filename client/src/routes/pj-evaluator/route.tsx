import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteErrorPage } from '@/components/ui/route-error'
import { requireRoles } from '@/stores/authStore'

export const Route = createFileRoute('/pj-evaluator')({
  // Authenticated dashboard data depends on browser-managed session state.
  ssr: false,
  beforeLoad: requireRoles(['PJ_EVALUATOR']),
  component: DashboardLayout,
  errorComponent: ({ error, reset }) => <RouteErrorPage error={error} reset={reset} />,
})