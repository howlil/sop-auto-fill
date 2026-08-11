import {
  getBuatVersiDariRiwayatBlockingReason,
  getNextSopVersion,
  isTerminalVersionStatus,
} from '@/lib/sop/sop-version-domain'

describe('sop version domain', () => {
  it('menghitung versi baru dari nomor tertinggi, bukan dari versi sumber', () => {
    expect(getNextSopVersion([{ versi: 1 }, { versi: 2 }])).toBe(3)
  })

  it.each(['DITOLAK_EVALUATOR', 'BERLAKU', 'DIGANTIKAN', 'DICABUT'])(
    'mengizinkan status terminal %s sebagai sumber',
    (status) => {
      expect(isTerminalVersionStatus(status)).toBe(true)
      expect(getBuatVersiDariRiwayatBlockingReason({ status, canBuatVersiBaru: true })).toBeNull()
    },
  )

  it('menolak sumber non-terminal', () => {
    expect(
      getBuatVersiDariRiwayatBlockingReason({
        status: 'DRAFT',
        canBuatVersiBaru: false,
      }),
    ).toContain('versi DITOLAK, BERLAKU, DIGANTIKAN, atau DICABUT')
  })

  it('memblokir sumber terminal ketika revisi lain masih berjalan', () => {
    expect(
      getBuatVersiDariRiwayatBlockingReason({
        status: 'DIGANTIKAN',
        canBuatVersiBaru: false,
      }),
    ).toContain('Masih ada revisi versi yang belum selesai')
  })
})
