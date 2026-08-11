import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BeritaAcaraTemplateProps } from '@/components/pengajuan/berita-acara-template'
import {
  buildBeritaAcaraPdfQrUrls,
  sanitizeBeritaAcaraPdfFilename,
} from '@/lib/print/download-berita-acara-pdf'

const baseProps: BeritaAcaraTemplateProps = {
  opd: 'Dinas Kesehatan',
  nomorBA: 'BA-Dinas Kesehatan Provinsi',
}

describe('sanitizeBeritaAcaraPdfFilename', () => {
  it('memakai nomor BA jika tersedia', () => {
    expect(sanitizeBeritaAcaraPdfFilename(baseProps)).toBe(
      'BA-BA-Dinas-Kesehatan-Provinsi.pdf',
    )
  })

  it('fallback ke nama OPD jika nomor BA kosong', () => {
    expect(
      sanitizeBeritaAcaraPdfFilename({
        ...baseProps,
        nomorBA: undefined,
      }),
    ).toBe('BA-Dinas-Kesehatan.pdf')
  })
})

describe('buildBeritaAcaraPdfQrUrls', () => {
  beforeEach(() => {
    vi.stubGlobal('location', {
      ...window.location,
      origin: 'http://localhost:5173',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('menghasilkan data URL QR untuk payload TTE', async () => {
    const actual = await buildBeritaAcaraPdfQrUrls({
      ...baseProps,
      tteSignaturePayloadPjEvaluator: {
        id: 'doc:user',
        dokumenTteId: 'doc-1',
        userId: 'user-1',
        nip: '123',
        namaLengkap: 'Evaluator',
      },
    })
    expect(actual.qrDataUrlPjEvaluator).toMatch(/^data:image\/png;base64,/)
    expect(actual.qrDataUrlPjPenyusun).toBeUndefined()
  })
})
