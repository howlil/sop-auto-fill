import { createFileRoute } from '@tanstack/react-router'
import { BeritaAcaraKoordinatorPage } from '@/pages/penyusun/koordinator/berita-acara/BeritaAcaraKoordinatorPage'
import { requireRoles } from '@/stores/authStore'

export const Route = createFileRoute('/penyusun/pj-penyusun/berita-acara/')({
  beforeLoad: requireRoles(['PJ_PENYUSUN']),
  component: BeritaAcaraKoordinatorPage,
})

