import { createFileRoute } from '@tanstack/react-router'
import { DetailBeritaAcaraPage } from '@/pages/penyusun/koordinator/berita-acara/DetailBeritaAcaraPage'
import { requireRoles } from '@/stores/authStore'

export const Route = createFileRoute('/penyusun/pj-penyusun/berita-acara/$id')({
  beforeLoad: requireRoles(['PJ_PENYUSUN']),
  component: DetailBeritaAcaraPage,
})

