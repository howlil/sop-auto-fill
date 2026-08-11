import { createFileRoute } from '@tanstack/react-router'
import { ManajemenPeraturan } from '@/pages/penyusun/peraturan/ManajemenPeraturan'

export const Route = createFileRoute('/penyusun/peraturan/')({
  component: ManajemenPeraturan,
})
