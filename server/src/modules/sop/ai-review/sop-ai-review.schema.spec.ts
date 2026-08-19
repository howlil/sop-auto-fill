import { parseAndCanonicalizeAiReview } from './sop-ai-review.schema';
import type { SopQualityReviewSnapshot } from './sop-ai-review.types';

const snapshot: SopQualityReviewSnapshot = {
  detailSopId: 'detail-1',
  versi: 1,
  judul: 'SOP Pelayanan',
  nomorSop: '001',
  namaLembaga: 'Unit Pelayanan',
  peringatan: ['Pastikan data benar'],
  kualifikasiPelaksanaan: ['Memahami layanan'],
  peralatanPerlengkapan: ['Komputer'],
  pencatatanPendataan: ['Register'],
  actors: [
    { pelaksanaId: 'actor-db-1', name: 'Petugas', order: 1 },
    { pelaksanaId: 'actor-db-2', name: 'Verifikator', order: 2 },
  ],
  steps: [
    {
      langkahSopId: 'step-db-1',
      urutan: 1,
      kegiatan: 'Menerima permohonan',
      jenis: 'AWAL_AKHIR',
      kelengkapan: 'Formulir',
      keluaran: 'Permohonan diterima',
      waktu: 5,
      satuanWaktu: 'm',
      keterangan: 'Catat',
      actorName: 'Petugas',
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
    {
      langkahSopId: 'step-db-2',
      urutan: 2,
      kegiatan: 'Memverifikasi permohonan',
      jenis: 'KEPUTUSAN',
      kelengkapan: 'Permohonan diterima',
      keluaran: 'Hasil verifikasi',
      waktu: 10,
      satuanWaktu: 'm',
      keterangan: 'Tentukan kelengkapan',
      actorName: 'Verifikator',
      targetYaUrutan: 1,
      targetTidakUrutan: 1,
    },
  ],
};

const validFinding = {
  severity: 'ERROR',
  category: 'DECISION_ROUTING',
  location: { kind: 'STEP', stepOrder: 2 },
  title: 'Routing keputusan tidak jelas',
  explanation: 'Jalur Ya dan Tidak mengarah ke langkah yang sama.',
  recommendation: 'Bedakan tujuan kedua cabang keputusan.',
} as const;

function validResult() {
  return {
    status: 'PERLU_PERBAIKAN',
    summary: 'Ada routing yang perlu diperiksa.',
    findings: [validFinding],
  };
}

describe('parseAndCanonicalizeAiReview', () => {
  it('memvalidasi output dan memangkas whitespace', () => {
    expect(
      parseAndCanonicalizeAiReview(
        {
          status: 'PERLU_PERBAIKAN',
          summary: '  Ada routing yang perlu diperiksa.  ',
          findings: [
            {
              ...validFinding,
              title: '  Routing keputusan tidak jelas  ',
              explanation: ' Jalur Ya dan Tidak mengarah ke langkah yang sama. ',
              recommendation: ' Bedakan tujuan kedua cabang keputusan. ',
            },
          ],
        },
        snapshot,
      ),
    ).toEqual({
      status: 'PERLU_PERBAIKAN',
      summary: 'Ada routing yang perlu diperiksa.',
      findings: [
        expect.objectContaining({
          title: 'Routing keputusan tidak jelas',
          explanation: 'Jalur Ya dan Tidak mengarah ke langkah yang sama.',
          recommendation: 'Bedakan tujuan kedua cabang keputusan.',
        }),
      ],
    });
  });

  it('menghapus finding duplikat secara deterministik setelah normalisasi', () => {
    const result = parseAndCanonicalizeAiReview(
      {
        ...validResult(),
        findings: [
          validFinding,
          {
            ...validFinding,
            title: '  ROUTING KEPUTUSAN TIDAK JELAS ',
          },
        ],
      },
      snapshot,
    );
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].title).toBe('Routing keputusan tidak jelas');
  });

  it('menerima actor reference yang sama setelah normalisasi nama', () => {
    const result = parseAndCanonicalizeAiReview(
      {
        status: 'CUKUP_BAIK',
        summary: 'Tanggung jawab aktor masih perlu diperjelas.',
        findings: [
          {
            severity: 'WARNING',
            category: 'ACTOR_RESPONSIBILITY',
            location: { kind: 'ACTOR', actorName: '  PETUGAS ' },
            title: 'Perjelas tanggung jawab',
            explanation: 'Tanggung jawab aktor masih dapat ditafsirkan berbeda.',
            recommendation: 'Gunakan uraian tanggung jawab yang lebih spesifik.',
          },
        ],
      },
      snapshot,
    );
    expect(result.findings[0].location).toEqual({ kind: 'ACTOR', actorName: 'Petugas' });
  });

  it('menolak step reference yang tidak ada pada snapshot', () => {
    expect(() =>
      parseAndCanonicalizeAiReview(
        {
          status: 'CUKUP_BAIK',
          summary: 'Review menemukan satu hal yang harus dicek.',
          findings: [
            {
              severity: 'WARNING',
              category: 'CLARITY',
              location: { kind: 'STEP', stepOrder: 99 },
              title: 'Langkah tidak ditemukan',
              explanation: 'Finding menunjuk langkah yang tidak ada pada snapshot.',
              recommendation: 'Gunakan langkah yang benar pada snapshot.',
            },
          ],
        },
        snapshot,
      ),
    ).toThrow();
  });

  it('menolak actor reference yang tidak ada pada snapshot', () => {
    expect(() =>
      parseAndCanonicalizeAiReview(
        {
          status: 'CUKUP_BAIK',
          summary: 'Review menemukan satu hal yang harus dicek.',
          findings: [
            {
              severity: 'WARNING',
              category: 'ACTOR_RESPONSIBILITY',
              location: { kind: 'ACTOR', actorName: 'Aktor Tidak Ada' },
              title: 'Aktor tidak ditemukan',
              explanation: 'Finding menunjuk aktor yang tidak ada pada snapshot.',
              recommendation: 'Gunakan aktor yang benar pada snapshot.',
            },
          ],
        },
        snapshot,
      ),
    ).toThrow();
  });

  it.each([
    ['status', { ...validResult(), status: 'APPROVED' }],
    [
      'severity',
      { ...validResult(), findings: [{ ...validFinding, severity: 'CRITICAL' }] },
    ],
    [
      'category',
      { ...validResult(), findings: [{ ...validFinding, category: 'LEGAL_COMPLIANCE' }] },
    ],
    [
      'location',
      { ...validResult(), findings: [{ ...validFinding, location: { kind: 'DATABASE', id: 'x' } }] },
    ],
  ])('menolak enum/shape invalid: %s', (_label, payload) => {
    expect(() => parseAndCanonicalizeAiReview(payload, snapshot)).toThrow();
  });

  it('menolak lebih dari 30 findings', () => {
    expect(() =>
      parseAndCanonicalizeAiReview(
        {
          ...validResult(),
          findings: Array.from({ length: 31 }, (_, index) => ({
            ...validFinding,
            title: `Routing keputusan ${index + 1}`,
          })),
        },
        snapshot,
      ),
    ).toThrow();
  });

  it.each([
    [{ ...validResult(), summary: 'pendek' }],
    [{ ...validResult(), summary: 'x'.repeat(1501) }],
    [{ ...validResult(), findings: [{ ...validFinding, title: 'x' }] }],
    [{ ...validResult(), findings: [{ ...validFinding, title: 'x'.repeat(161) }] }],
    [{ ...validResult(), findings: [{ ...validFinding, explanation: 'pendek' }] }],
    [{ ...validResult(), findings: [{ ...validFinding, explanation: 'x'.repeat(1001) }] }],
    [{ ...validResult(), findings: [{ ...validFinding, recommendation: 'x' }] }],
    [{ ...validResult(), findings: [{ ...validFinding, recommendation: 'x'.repeat(1001) }] }],
  ])('menolak string kosong/di luar batas', (payload) => {
    expect(() => parseAndCanonicalizeAiReview(payload, snapshot)).toThrow();
  });
});
