import { createFileRoute } from '@tanstack/react-router'
import { PantauSOP } from '@/pages/kepala-opd/sop/PantauSOP'

export const Route = createFileRoute('/kepala-opd/sop/')({
  component: PantauSOP,
})
