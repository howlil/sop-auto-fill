import { Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ManajemenSOP } from '@/pages/penyusun/sop/ManajemenSOP'
import { RouteErrorPage } from '@/components/ui/route-error'
import { queryClient } from '@/config/query-client'
import { queryKeys } from '@/config/query-keys'
import { sopApi } from '@/api/sop'

export const Route = createFileRoute('/penyusun/sop/')({
  loader: async () => {
    if (typeof window === 'undefined') return
    await queryClient.ensureQueryData({
      queryKey: queryKeys.sopList(),
      queryFn: () => sopApi.findAll(),
    })
  },
  component: ManajemenSOPPage,
  errorComponent: ({ error, reset }) => <RouteErrorPage error={error} reset={reset} />,
})

function ManajemenSOPPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-secondary-foreground">
          Memuat daftar SOP…
        </div>
      }
    >
      <ManajemenSOP />
    </Suspense>
  )
}
