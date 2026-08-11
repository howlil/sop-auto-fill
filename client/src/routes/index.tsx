import { lazy, Suspense } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { zodSearchValidator } from '@tanstack/router-zod-adapter'
import { RouteErrorPage } from '@/components/ui/route-error'
import { getRoleDefaultLandingPath } from '@/utils/role-routing'
import { getRole, ensureAuthHydrated, syncAuthFromCookie } from '@/stores/authStore'

const homeSearchSchema = z.object({
  denied: z.coerce.boolean().optional(),
  redirect: z.string().max(2048).optional(),
})

const LandingPage = lazy(() =>
  import('@/pages/LandingPage').then((m) => ({ default: m.LandingPage })),
)

function HomeRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface-subtle">
          <div className="text-center text-sm text-secondary-foreground">Memuat beranda…</div>
        </div>
      }
    >
      <LandingPage />
    </Suspense>
  )
}

export const Route = createFileRoute('/')({
  validateSearch: zodSearchValidator(homeSearchSchema),
  beforeLoad: async () => {
    await ensureAuthHydrated()
    if (!getRole()) {
      await syncAuthFromCookie()
    }
    const userRole = getRole()
    if (!userRole) {
      return
    }
    const targetRoute = getRoleDefaultLandingPath(userRole)
    if (targetRoute) {
      throw redirect({ to: targetRoute })
    }
  },
  component: HomeRoutePage,
  errorComponent: ({ error, reset }) => <RouteErrorPage error={error} reset={reset} />,
})
