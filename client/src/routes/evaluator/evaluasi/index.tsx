import { createFileRoute } from '@tanstack/react-router'
import { DaftarSOPEvaluasi } from '@/pages/evaluator/evaluasi/DaftarSOPEvaluasi'

function parseEvaluasiIndexSearch(raw: Record<string, unknown>): {
  opdId?: string
} {
  const opdId = raw.opdId
  return {
    opdId: typeof opdId === 'string' && opdId.length > 0 ? opdId : undefined,
  }
}

export const Route = createFileRoute('/evaluator/evaluasi/')({
  validateSearch: parseEvaluasiIndexSearch,
  component: DaftarSOPEvaluasi,
})
