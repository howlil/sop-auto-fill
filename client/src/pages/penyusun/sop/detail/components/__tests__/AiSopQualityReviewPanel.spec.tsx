import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiSopQualityReviewPanel } from '../AiSopQualityReviewPanel'
import type { SopQualityReviewResponse } from '@/api/workspace-sops'

const review: SopQualityReviewResponse = {
  reviewedDetailSopId: 'detail-1',
  reviewedVersion: 1,
  result: {
    status: 'PERLU_PERBAIKAN',
    summary: 'Ada beberapa bagian yang perlu diperiksa oleh penyusun sebelum review manusia.',
    findings: [
      {
        severity: 'ERROR',
        category: 'DECISION_ROUTING',
        location: { kind: 'STEP', stepOrder: 2 },
        title: 'Routing keputusan ambigu',
        explanation: 'Cabang keputusan belum menunjukkan tujuan yang berbeda secara jelas.',
        recommendation: 'Periksa dan bedakan tujuan cabang Ya dan Tidak.',
      },
      {
        severity: 'SUGGESTION',
        category: 'SUPPORTING_FIELD',
        location: { kind: 'PERINGATAN' },
        title: 'Perjelas peringatan',
        explanation: 'Peringatan dapat dibuat lebih operasional bagi pelaksana SOP.',
        recommendation: 'Gunakan kalimat yang menjelaskan risiko yang perlu dihindari.',
      },
    ],
  },
}

describe('AiSopQualityReviewPanel', () => {
  it('menampilkan CTA dan advisory copy sebelum review tersedia', () => {
    render(
      <AiSopQualityReviewPanel
        isAvailable
        isAvailabilityLoading={false}
        isRunning={false}
        review={null}
        error={null}
        onRunReview={vi.fn()}
        onSelectFinding={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Periksa dengan AI' })).toBeEnabled()
    expect(screen.getByText(/saran AI/i)).toBeInTheDocument()
    expect(screen.getByText(/bukan persetujuan/i)).toBeInTheDocument()
  })

  it('menonaktifkan CTA ketika provider unavailable atau request berjalan', () => {
    const { rerender } = render(
      <AiSopQualityReviewPanel
        isAvailable={false}
        isAvailabilityLoading={false}
        isRunning={false}
        review={null}
        error={null}
        onRunReview={vi.fn()}
        onSelectFinding={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Periksa dengan AI' })).toBeDisabled()
    expect(screen.getByText(/belum tersedia/i)).toBeInTheDocument()

    rerender(
      <AiSopQualityReviewPanel
        isAvailable
        isAvailabilityLoading={false}
        isRunning
        review={null}
        error={null}
        onRunReview={vi.fn()}
        onSelectFinding={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /memeriksa/i })).toBeDisabled()
  })

  it('menampilkan summary dan finding terstruktur lalu meneruskan lokasi saat dipilih', () => {
    const onSelectFinding = vi.fn()
    render(
      <AiSopQualityReviewPanel
        isAvailable
        isAvailabilityLoading={false}
        isRunning={false}
        review={review}
        error={null}
        onRunReview={vi.fn()}
        onSelectFinding={onSelectFinding}
      />,
    )

    expect(screen.getByText('Perlu perbaikan')).toBeInTheDocument()
    expect(screen.getByText(review.result.summary)).toBeInTheDocument()
    expect(screen.getByText('Routing keputusan ambigu')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Langkah 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /buka routing keputusan ambigu/i }))
    expect(onSelectFinding).toHaveBeenCalledWith(review.result.findings[0])
  })

  it('menampilkan error autosave/provider secara inline tanpa menghilangkan CTA', () => {
    render(
      <AiSopQualityReviewPanel
        isAvailable
        isAvailabilityLoading={false}
        isRunning={false}
        review={null}
        error={new Error('Simpan perubahan SOP terlebih dahulu')}
        onRunReview={vi.fn()}
        onSelectFinding={vi.fn()}
      />,
    )

    expect(screen.getByText('Simpan perubahan SOP terlebih dahulu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Periksa dengan AI' })).toBeEnabled()
  })
})
