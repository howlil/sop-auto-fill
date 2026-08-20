import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiSopQualityReviewPanel } from '../AiSopQualityReviewPanel'
import type {
  SopAiRevisionResponse,
  SopQualityReviewResponse,
} from '@/api/workspace-sops'

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

const proposal: SopAiRevisionResponse = {
  sourceDetailSopId: 'detail-1',
  sourceVersion: 1,
  suggestion: {
    target: { kind: 'PERINGATAN', itemIndex: 0 },
    before: 'Hindari kesalahan',
    after: 'Pastikan data diverifikasi sebelum dokumen diteruskan',
    rationale: 'Peringatan menjadi lebih operasional.',
  },
}

function revisionProps(overrides: Partial<{
  isAvailable: boolean
  isAvailabilityLoading: boolean
  isRunning: boolean
  proposal: SopAiRevisionResponse | null
  error: Error | null
  onSuggest: ReturnType<typeof vi.fn>
  onCancel: ReturnType<typeof vi.fn>
  onApply: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    isAvailable: true,
    isAvailabilityLoading: false,
    isRunning: false,
    proposal: null,
    error: null,
    onSuggest: vi.fn(),
    onCancel: vi.fn(),
    onApply: vi.fn(),
    ...overrides,
  }
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
        aiRevision={revisionProps()}
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
        aiRevision={revisionProps()}
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
        aiRevision={revisionProps()}
      />,
    )
    expect(screen.getByRole('button', { name: /memeriksa/i })).toBeDisabled()
  })

  it('mempertahankan navigasi finding dan membedakan finding revision-eligible dari manual-only', () => {
    const onSelectFinding = vi.fn()
    const aiRevision = revisionProps()
    render(
      <AiSopQualityReviewPanel
        isAvailable
        isAvailabilityLoading={false}
        isRunning={false}
        review={review}
        error={null}
        onRunReview={vi.fn()}
        onSelectFinding={onSelectFinding}
        aiRevision={aiRevision}
      />,
    )

    expect(screen.getByText('Perlu perbaikan')).toBeInTheDocument()
    expect(screen.getByText('Routing keputusan ambigu')).toBeInTheDocument()
    expect(screen.getByText(/perbaiki secara manual/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sarankan perbaikan perjelas peringatan/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /sarankan perbaikan routing keputusan ambigu/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /buka routing keputusan ambigu/i }))
    expect(onSelectFinding).toHaveBeenCalledWith(review.result.findings[0])
    fireEvent.click(screen.getByRole('button', { name: /sarankan perbaikan perjelas peringatan/i }))
    expect(aiRevision.onSuggest).toHaveBeenCalledWith(review.result.findings[1])
  })

  it('menampilkan before/after preview dan explicit cancel/apply', () => {
    const onCancel = vi.fn()
    const onApply = vi.fn()
    render(
      <AiSopQualityReviewPanel
        isAvailable
        isAvailabilityLoading={false}
        isRunning={false}
        review={review}
        error={null}
        onRunReview={vi.fn()}
        onSelectFinding={vi.fn()}
        aiRevision={revisionProps({ proposal, onCancel, onApply })}
      />,
    )

    expect(screen.getByText('Peringatan 1')).toBeInTheDocument()
    expect(screen.getByText('Sebelum')).toBeInTheDocument()
    expect(screen.getByText('Hindari kesalahan')).toBeInTheDocument()
    expect(screen.getByText('Usulan')).toBeInTheDocument()
    expect(screen.getByText('Pastikan data diverifikasi sebelum dokumen diteruskan')).toBeInTheDocument()
    expect(screen.getByText('Peringatan menjadi lebih operasional.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Terapkan' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onApply).toHaveBeenCalledOnce()
  })

  it('revision provider disabled tidak menghilangkan finding AI Review', () => {
    render(
      <AiSopQualityReviewPanel
        isAvailable
        isAvailabilityLoading={false}
        isRunning={false}
        review={review}
        error={null}
        onRunReview={vi.fn()}
        onSelectFinding={vi.fn()}
        aiRevision={revisionProps({ isAvailable: false })}
      />,
    )
    expect(screen.getByText('Perjelas peringatan')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sarankan perbaikan/i })).not.toBeInTheDocument()
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
        aiRevision={revisionProps()}
      />,
    )

    expect(screen.getByText('Simpan perubahan SOP terlebih dahulu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Periksa dengan AI' })).toBeEnabled()
  })
})
