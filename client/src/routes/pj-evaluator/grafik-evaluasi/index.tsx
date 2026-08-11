import { createFileRoute } from '@tanstack/react-router'
import { GrafikEvaluasiTahunan, getDefaultGrafikEvaluasiTahunQuery } from '@/pages/pj-evaluator/grafik-evaluasi/GrafikEvaluasiTahunan'
import { RouteErrorPage } from '@/components/ui/route-error'
import { queryClient } from '@/config/query-client'
import { queryKeys } from '@/config/query-keys'
import { evaluasiApi } from "@/api/evaluasi";

export const Route = createFileRoute('/pj-evaluator/grafik-evaluasi/')({
  loader: async () => {
    if (typeof window === 'undefined') return
    const q = getDefaultGrafikEvaluasiTahunQuery()
    await queryClient.ensureQueryData({
      queryKey: queryKeys.evaluasiGrafikTahunan(q),
      queryFn: () => evaluasiApi.grafikTahunan(q),
    })
  },
  component: GrafikEvaluasiTahunan,
  errorComponent: ({ error, reset }) => (
    <RouteErrorPage error={error} reset={reset} />
  ),
})
