import { render, screen } from '@testing-library/react'
import { BuatVersiBaruDialog } from '@/pages/penyusun/sop/components/BuatVersiBaruDialog'

describe('BuatVersiBaruDialog', () => {
  it('menjelaskan sumber riwayat, nomor hasil, dan sifat non-destruktif', () => {
    render(
      <BuatVersiBaruDialog
        open
        onOpenChange={() => undefined}
        judulSop="SOP Pengujian"
        versiSumber={1}
        statusSumber="Digantikan"
        versiBaru={3}
        onConfirm={() => undefined}
      />,
    )

    expect(
      screen.getByText(/Isi versi 1 \(Digantikan\) akan disalin menjadi versi 3/),
    ).toBeVisible()
    expect(screen.getByText(/riwayat semua versi lama tidak berubah/)).toBeVisible()
    expect(screen.getByText('SOP Pengujian')).toBeVisible()
  })
})
