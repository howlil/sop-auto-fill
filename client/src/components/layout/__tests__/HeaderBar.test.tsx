import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@/hooks/useAppRole', () => ({
  useAppRole: () => ({
    role: 'PJ_PENYUSUN',
    getRoleLabel: () => 'PJ Penyusun',
    getRoleNip: () => '',
    getRoleDisplayName: () => 'Pengguna Uji',
  }),
}))

vi.mock('@/api/auth', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}))

import { HeaderBar } from '@/components/layout/HeaderBar'
import {
  PageHeaderProvider,
  SetPageHeader,
} from '@/components/layout/PageHeaderProvider'

describe('HeaderBar', () => {
  it('hanya menampilkan nama halaman tanpa breadcrumb peran', async () => {
    render(
      <PageHeaderProvider>
        <HeaderBar />
        <SetPageHeader
          breadcrumb={[{ label: 'PJ Penyusun' }, { label: 'Berita Acara' }]}
          title="Berita Acara Evaluasi"
        />
      </PageHeaderProvider>,
    )

    const title = await screen.findByRole('heading', {
      name: 'Berita Acara Evaluasi',
    })

    expect(title).toHaveClass('text-ui-title')
    await waitFor(() => {
      expect(screen.queryByText('PJ Penyusun')).not.toBeInTheDocument()
    })
  })
})
