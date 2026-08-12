import { createFileRoute, redirect } from '@tanstack/react-router'
import { ensureAuthHydrated, syncAuthFromCookie, useAuthStore } from '@/stores/authStore'
import { LandingPage } from '@/pages/LandingPage'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') return
    await ensureAuthHydrated()
    if (!useAuthStore.getState().user) {
      await syncAuthFromCookie()
    }
    if (useAuthStore.getState().user) {
      throw redirect({ href: '/workspaces' })
    }
  },
  component: LandingPage,
})
