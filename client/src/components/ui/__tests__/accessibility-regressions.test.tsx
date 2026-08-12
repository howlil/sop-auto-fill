import { useState } from 'react'
import { Eye } from 'lucide-react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SopStatusBadge } from '@/components/status/sop-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DataTableActionTd,
  DataTableActionTh,
  DataTableCard,
  DataTableHeaderRow,
  PaginatedTable,
  DataTableRoot,
  DataTableTable,
  DataTableTh,
} from '@/components/ui/data-table'
import { RowActions } from '@/components/data/row-actions'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { OptionCardPicker } from '@/components/ui/option-card-picker'
import { Pagination } from '@/components/ui/pagination'
import { LoadingState } from '@/components/ui/loading-state'
import { Toast } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

describe('regresi aksesibilitas komponen UI', () => {
  it('menggunakan warna primer yang kontras untuk tombol utama', () => {
    render(<Button>Simpan</Button>)

    const button = screen.getByRole('button', { name: 'Simpan' })
    expect(button).toHaveClass('bg-primary', 'text-white', 'hover:bg-primary-hover')
    expect(button).toHaveAttribute('data-button-appearance', 'solid')
    expect(button).not.toHaveClass('bg-blue-500')
  })

  it('menjaga label putih pada seluruh varian tombol solid', () => {
    const { rerender } = render(<Button>Tambah</Button>)

    expect(screen.getByRole('button', { name: 'Tambah' })).toHaveClass('text-white')

    rerender(<Button variant="destructive">Hapus</Button>)
    expect(screen.getByRole('button', { name: 'Hapus' })).toHaveClass('text-white')
    expect(screen.getByRole('button', { name: 'Hapus' })).toHaveAttribute(
      'data-button-appearance',
      'solid',
    )

    rerender(<Button variant="outline">Batal</Button>)
    expect(screen.getByRole('button', { name: 'Batal' })).toHaveAttribute(
      'data-button-appearance',
      'non-solid',
    )
  })

  it('memberi batas kontrol yang terlihat jelas pada input', () => {
    render(<Input aria-label="Nama" />)

    expect(screen.getByRole('textbox', { name: 'Nama' })).toHaveClass(
      'border-border-strong',
      'focus:ring-primary',
    )
  })

  it('mempertahankan tinggi minimum badge penting sebesar 24 piksel', () => {
    render(<Badge variant="default">Aktif</Badge>)

    expect(screen.getByText('Aktif')).toHaveClass('min-h-6', 'text-primary-hover')
  })

  it('menjaga status panjang tetap satu baris dengan bentuk pill dan warna kontras', () => {
    render(<SopStatusBadge status="COMPLETED" label="SOP selesai" showDomain={false} />)

    const status = screen.getByText('SOP selesai')
    expect(status).toHaveClass(
      'whitespace-nowrap',
      'rounded-full',
      'bg-emerald-100',
      'text-emerald-800',
    )
    expect(status.parentElement).toHaveClass('flex-nowrap', 'whitespace-nowrap')
  })

  it('menggunakan peran visual semantik pada permukaan kartu', () => {
    render(<Card>Ringkasan</Card>)

    expect(screen.getByText('Ringkasan')).toHaveClass(
      'rounded-surface',
      'border-border',
      'bg-surface',
      'shadow-surface',
    )
  })

  it('memberi affordance scroll dan header sticky pada tabel data', () => {
    render(
      <DataTableRoot aria-label="Daftar SOP">
        <DataTableTable>
          <thead>
            <DataTableHeaderRow>
              <DataTableTh align="right">Jumlah</DataTableTh>
            </DataTableHeaderRow>
          </thead>
        </DataTableTable>
      </DataTableRoot>,
    )

    expect(screen.getByRole('region', { name: 'Daftar SOP' })).toHaveClass(
      'overscroll-x-contain',
    )
    expect(screen.getByRole('region', { name: 'Daftar SOP' })).not.toHaveClass(
      '[scrollbar-gutter:stable]',
    )
    expect(screen.getByRole('row')).toHaveClass('sticky', 'top-0')
    expect(screen.getByRole('table')).toHaveClass('text-[13px]/[18px]')
    expect(screen.getByRole('columnheader', { name: 'Jumlah' })).toHaveClass(
      'whitespace-nowrap',
      'text-right',
      'font-medium',
      'py-2',
    )
  })

  it('memakai shell tabel yang sama dan memotong header tepat di sudut kartu', () => {
    const { rerender } = render(
      <DataTableCard data-testid="table-card">
        <DataTableRoot>
          <DataTableTable aria-label="Tabel kartu" />
        </DataTableRoot>
      </DataTableCard>,
    )

    expect(screen.getByTestId('table-card')).toHaveClass(
      'isolate',
      'overflow-clip',
      'rounded-surface',
    )

    rerender(
      <PaginatedTable data={[1]} label="contoh">
        {() => <DataTableTable aria-label="Tabel paginasi" />}
      </PaginatedTable>,
    )

    expect(screen.getByRole('table', { name: 'Tabel paginasi' }).parentElement).toHaveClass(
      'isolate',
      'overflow-clip',
      'rounded-surface',
    )
  })

  it('meratakan aksi tabel ke kiri dan menjaga ikon lihat tanpa border', () => {
    render(
      <DataTableRoot aria-label="Daftar SOP">
        <DataTableTable>
          <thead>
            <DataTableHeaderRow>
              <DataTableActionTh>Aksi</DataTableActionTh>
            </DataTableHeaderRow>
          </thead>
          <tbody>
            <tr>
              <DataTableActionTd>
                <RowActions
                  actions={[{ icon: Eye, title: 'Lihat detail', onClick: vi.fn() }]}
                />
              </DataTableActionTd>
            </tr>
          </tbody>
        </DataTableTable>
      </DataTableRoot>,
    )

    expect(screen.getByRole('columnheader', { name: 'Aksi' })).toHaveClass(
      'w-0',
      'text-left',
    )
    expect(screen.getByRole('cell')).toHaveClass('w-0', 'text-left')

    const viewButton = screen.getByRole('button', { name: 'Lihat detail' })
    expect(viewButton.parentElement).toHaveClass('justify-start')
    expect(viewButton).not.toHaveClass('border')
  })

  it('mengumumkan loading dan tipe feedback secara eksplisit', () => {
    const { rerender } = render(<LoadingState message="Memuat daftar SOP…" />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Memuat daftar SOP…')).toBeInTheDocument()

    rerender(<Toast type="info" message="Data sedang disinkronkan" />)
    expect(screen.getByRole('status')).toHaveClass('bg-info-subtle')
  })

  it('menampilkan pesan error input dan menghubungkannya ke field', () => {
    render(<Input aria-label="Email" errorMessage="Email wajib diisi" />)

    const input = screen.getByRole('textbox', { name: 'Email' })
    const error = screen.getByRole('alert')

    expect(error).toHaveTextContent('Email wajib diisi')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', error.id)
  })

  it('memberi nama dan status wajib pada input di dalam FormField tanpa htmlFor manual', () => {
    render(
      <FormField label="Nomor SOP" required>
        <Input />
      </FormField>,
    )

    expect(screen.getByRole('textbox', { name: /Nomor SOP/ })).toHaveAttribute(
      'aria-required',
      'true',
    )
  })

  it('mengumumkan pilihan kartu sebagai radio yang terpilih', () => {
    const onChange = vi.fn()
    render(
      <OptionCardPicker
        label="Status SOP"
        options={[
          { value: 'draft', label: 'Draft' },
          { value: 'completed', label: 'Selesai' },
        ]}
        value="draft"
        onChange={onChange}
      />,
    )

    expect(screen.getByRole('radiogroup', { name: 'Status SOP' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Draft' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('radio', { name: 'Selesai' }))
    expect(onChange).toHaveBeenCalledWith('completed')
  })

  it('memindahkan pilihan radio kartu dengan tombol panah', () => {
    function PickerHarness() {
      const [value, setValue] = useState('draft')
      return (
        <OptionCardPicker
          label="Status SOP"
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'completed', label: 'Selesai' },
          ]}
          value={value}
          onChange={setValue}
        />
      )
    }

    render(<PickerHarness />)
    const first = screen.getByRole('radio', { name: 'Draft' })
    const second = screen.getByRole('radio', { name: 'Selesai' })

    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })

    expect(second).toHaveFocus()
    expect(second).toHaveAttribute('aria-checked', 'true')
    expect(second).toHaveAttribute('tabindex', '0')
  })

  it('menandai halaman pagination yang sedang aktif', () => {
    render(
      <Pagination totalItems={40} currentPage={2} pageSize={10} onPageChange={vi.fn()} label="SOP" />,
    )

    expect(screen.getByRole('navigation', { name: 'Navigasi halaman SOP' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Halaman 2' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('menyediakan tombol tutup bawaan pada dialog', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Konfirmasi</DialogTitle>
          <DialogDescription>Periksa data sebelum melanjutkan.</DialogDescription>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByRole('dialog', { name: 'Konfirmasi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tutup dialog' })).toBeInTheDocument()
  })
})
