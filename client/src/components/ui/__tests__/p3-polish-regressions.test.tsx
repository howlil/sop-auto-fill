import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PanelTabStrip } from '@/components/ui/collapsible-side-panel'
import { Pagination } from '@/components/ui/pagination'
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

describe('regresi polish UI P3', () => {
  it('membuat daftar tab aman untuk label yang lebih lebar', () => {
    render(
      <Tabs defaultValue="aktif">
        <TabsList aria-label="Status pengajuan">
          <TabsTrigger value="aktif">Sedang diproses</TabsTrigger>
          <TabsTrigger value="selesai">Sudah selesai</TabsTrigger>
        </TabsList>
      </Tabs>,
    )

    expect(screen.getByRole('tablist', { name: 'Status pengajuan' })).toHaveClass(
      'max-w-full',
      'overflow-x-auto',
      'overscroll-x-contain',
    )
    expect(screen.getByRole('tab', { name: 'Sedang diproses' })).toHaveClass('shrink-0')
  })

  it('menyediakan ringkasan pagination yang ringkas untuk layar kecil', () => {
    render(
      <Pagination
        totalItems={240}
        currentPage={12}
        pageSize={10}
        label="SOP"
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Halaman 12 dari 24')).toHaveClass('sm:hidden')
    expect(screen.getByRole('button', { name: 'Halaman 12' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('menggunakan checkbox native dan mengumumkan jumlah pilihan', () => {
    const onConfirm = vi.fn()
    render(
      <SearchableSelectDialog
        open
        onOpenChange={vi.fn()}
        title="Pilih SOP"
        description="Pilih dokumen yang akan ditambahkan."
        searchPlaceholder="Cari SOP"
        items={[
          { id: '1', name: 'SOP Pelayanan' },
          { id: '2', name: 'SOP Pengaduan' },
        ]}
        getId={(item) => item.id}
        getSearchText={(item) => item.name}
        renderItem={(item) => <span>{item.name}</span>}
        emptyMessage="Belum ada SOP."
        emptySearchMessage="SOP tidak ditemukan."
        onConfirm={onConfirm}
      />,
    )

    const checkbox = screen.getByRole('checkbox', { name: 'SOP Pelayanan' })
    fireEvent.click(checkbox)

    expect(checkbox).toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('2 pilihan ditemukan · 1 dipilih')

    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan' }))
    expect(onConfirm).toHaveBeenCalledWith(['1'])
  })

  it('memindahkan tab panel dengan tombol panah', () => {
    function PanelTabsHarness() {
      const [activeTab, setActiveTab] = useState('detail')
      return (
        <PanelTabStrip
          ariaLabel="Informasi SOP"
          tabs={[
            { id: 'detail', label: 'Detail' },
            { id: 'riwayat', label: 'Riwayat' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )
    }

    render(<PanelTabsHarness />)
    const detailTab = screen.getByRole('tab', { name: 'Detail' })
    const historyTab = screen.getByRole('tab', { name: 'Riwayat' })

    detailTab.focus()
    fireEvent.keyDown(detailTab, { key: 'ArrowRight' })

    expect(historyTab).toHaveFocus()
    expect(historyTab).toHaveAttribute('aria-selected', 'true')
    expect(historyTab).toHaveAttribute('tabindex', '0')
  })

  it('menyembunyikan skeleton dekoratif dari teknologi bantu', () => {
    const { container } = render(<Skeleton className="h-4" />)

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.firstChild).toHaveClass('motion-reduce:animate-none')
  })
})
