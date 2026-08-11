import { createFileRoute } from '@tanstack/react-router'
import { PelaksanaSOP } from '@/pages/penyusun/pelaksana/PelaksanaSOP'

export const Route = createFileRoute('/penyusun/pelaksana/')({
  component: PelaksanaSOP,
})
