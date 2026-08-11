import { createFileRoute } from '@tanstack/react-router'
import { DetailPengajuanEvaluasi } from '@/pages/pj-evaluator/evaluasi/DetailPengajuanEvaluasi'
import { RouteErrorPage } from '@/components/ui/route-error'

export const Route = createFileRoute('/pj-evaluator/evaluasi/$id')({
  component: DetailPengajuanEvaluasiPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorPage error={error} reset={reset} />
  ),
})

function DetailPengajuanEvaluasiPage() {
  return <DetailPengajuanEvaluasi />
}
