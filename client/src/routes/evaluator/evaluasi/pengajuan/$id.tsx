import { createFileRoute } from '@tanstack/react-router'
import { DetailEvaluasiPengajuan } from '@/pages/evaluator/evaluasi/DetailEvaluasiPengajuan'
import { RouteErrorPage } from '@/components/ui/route-error'

function parseEvaluasiPengajuanSearch(raw: Record<string, unknown>): {
  sopId?: string
} {
  const sopId = raw.sopId
  return {
    sopId: typeof sopId === 'string' && sopId.length > 0 ? sopId : undefined,
  }
}

export const Route = createFileRoute('/evaluator/evaluasi/pengajuan/$id')({
  validateSearch: parseEvaluasiPengajuanSearch,
  component: DetailEvaluasiPengajuanPage,
  errorComponent: ({ error, reset }) => <RouteErrorPage error={error} reset={reset} />,
})

function DetailEvaluasiPengajuanPage() {
  return <DetailEvaluasiPengajuan />
}
