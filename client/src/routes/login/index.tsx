import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { zodSearchValidator } from '@tanstack/router-zod-adapter'
import { LoginPage } from '@/pages/login/LoginPage'
import { RouteErrorPage } from '@/components/ui/route-error'
import { ensureAuthHydrated, syncAuthFromCookie, useAuthStore } from '@/stores/authStore'

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login/')({
  validateSearch: zodSearchValidator(loginSearchSchema),
  beforeLoad: async ({ search }) => {
    if (typeof window === 'undefined') return
    await ensureAuthHydrated()
    await syncAuthFromCookie()
    if (!useAuthStore.getState().user) return

    const destination =
      typeof search.redirect === 'string' && search.redirect.startsWith('/')
        ? search.redirect
        : '/workspaces'
    throw redirect({ href: destination })
  },
  component: LoginPage,
  errorComponent: ({ error, reset }) => <RouteErrorPage error={error} reset={reset} />,
})
