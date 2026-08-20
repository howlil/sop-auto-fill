import type { SopAiSnapshot } from '../ai-common/sop-ai-snapshot.types';
import type { SopQualityFinding } from '../ai-review/sop-ai-review.types';
import {
  deriveAllowedRevisionTargets,
  parseAndCanonicalizeAiRevision,
  readRevisionTargetValue,
  revisionTargetKey,
} from './sop-ai-revision.schema';

const snapshot: SopAiSnapshot = {
  detailSopId: 'detail-db-1',
  versi: 2,
  judul: 'SOP Pelayanan',
  nomorSop: '001/SOP',
  namaLembaga: 'Unit Pelayanan',
  peringatan: ['Pastikan data benar', 'Gunakan dokumen terbaru'],
  kualifikasiPelaksanaan: ['Memahami layanan'],
  peralatanPerlengkapan: ['Komputer'],
  pencatatanPendataan: ['Register'],
  actors: [{ pelaksanaId: 'actor-db-1', name: 'Petugas', order: 1 }],
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
      actorName: 'Petugas',
      targetYaUrutan: 1,
      targetTidakUrutan: 1,
    },
  ],
};

function finding(
  overrides: Partial<SopQualityFinding> & Pick<SopQualityFinding, 'category' | 'location'>,
): SopQualityFinding {
  return {
    severity: 'WARNING',
    title: 'Temuan kualitas',
    explanation: 'Penjelasan temuan kualitas yang cukup panjang.',
    recommendation: 'Perjelas bagian yang ditandai.',
    ...overrides,
  };
}

describe('deriveAllowedRevisionTargets', () => {
  it('allows only title for HEADER + CLARITY', () => {
    expect(
      deriveAllowedRevisionTargets(
        finding({ location: { kind: 'HEADER' }, category: 'CLARITY' }),
        snapshot,
      ),
    ).toEqual([{ kind: 'HEADER', field: 'JUDUL' }]);
    expect(
      deriveAllowedRevisionTargets(
        finding({ location: { kind: 'HEADER' }, category: 'COMPLETENESS' }),
        snapshot,
      ),
    ).toEqual([]);
  });

  it('allows every existing zero-based warning item for eligible PERINGATAN findings', () => {
    expect(
      deriveAllowedRevisionTargets(
        finding({ location: { kind: 'PERINGATAN' }, category: 'SUPPORTING_FIELD' }),
        snapshot,
      ),
    ).toEqual([
      { kind: 'PERINGATAN', itemIndex: 0 },
      { kind: 'PERINGATAN', itemIndex: 1 },
    ]);
    expect(
      deriveAllowedRevisionTargets(
        finding({ location: { kind: 'PERINGATAN' }, category: 'COMPLETENESS' }),
        { ...snapshot, peringatan: [] },
      ),
    ).toEqual([]);
  });

  it('maps STEP finding categories to the conservative text-field allowlist', () => {
    expect(
      deriveAllowedRevisionTargets(
        finding({ location: { kind: 'STEP', stepOrder: 2 }, category: 'INPUT_OUTPUT' }),
        snapshot,
      ),
    ).toEqual([
      { kind: 'STEP', stepOrder: 2, field: 'KELENGKAPAN' },
      { kind: 'STEP', stepOrder: 2, field: 'KELUARAN' },
    ]);
    expect(
      deriveAllowedRevisionTargets(
        finding({ location: { kind: 'STEP', stepOrder: 2 }, category: 'CLARITY' }),
        snapshot,
      ),
    ).toEqual([
      { kind: 'STEP', stepOrder: 2, field: 'KEGIATAN' },
      { kind: 'STEP', stepOrder: 2, field: 'KETERANGAN' },
    ]);
    expect(
      deriveAllowedRevisionTargets(
        finding({ location: { kind: 'STEP', stepOrder: 2 }, category: 'SUPPORTING_FIELD' }),
        snapshot,
      ),
    ).toEqual([{ kind: 'STEP', stepOrder: 2, field: 'KETERANGAN' }]);
    expect(
      deriveAllowedRevisionTargets(
        finding({ location: { kind: 'STEP', stepOrder: 999 }, category: 'CLARITY' }),
        snapshot,
      ),
    ).toEqual([]);
  });

  it.each([
    finding({ location: { kind: 'ACTOR', actorName: 'Petugas' }, category: 'CLARITY' }),
    finding({ location: { kind: 'STEP', stepOrder: 2 }, category: 'DECISION_ROUTING' }),
    finding({ location: { kind: 'STEP', stepOrder: 2 }, category: 'TIME_PLAUSIBILITY' }),
    finding({ location: { kind: 'STEP', stepOrder: 2 }, category: 'PROCESS_STRUCTURE' }),
    finding({ location: { kind: 'STEP', stepOrder: 2 }, category: 'ACTOR_RESPONSIBILITY' }),
  ])('keeps unsafe/structural findings manual', (unsafeFinding) => {
    expect(deriveAllowedRevisionTargets(unsafeFinding, snapshot)).toEqual([]);
  });
});

describe('revision proposal canonicalization', () => {
  const inputOutputFinding = finding({
    location: { kind: 'STEP', stepOrder: 2 },
    category: 'INPUT_OUTPUT',
  });

  it('derives before from the authoritative snapshot and trims provider text', () => {
    expect(
      parseAndCanonicalizeAiRevision(
        {
          target: { kind: 'STEP', stepOrder: 2, field: 'KELUARAN' },
          after: '  Berita acara hasil verifikasi  ',
          rationale: '  Membuat keluaran lebih spesifik.  ',
        },
        inputOutputFinding,
        snapshot,
      ),
    ).toEqual({
      target: { kind: 'STEP', stepOrder: 2, field: 'KELUARAN' },
      before: 'Hasil verifikasi',
      after: 'Berita acara hasil verifikasi',
      rationale: 'Membuat keluaran lebih spesifik.',
    });
  });

  it('rejects targets outside the finding allowlist and invalid locations', () => {
    expect(() =>
      parseAndCanonicalizeAiRevision(
        {
          target: { kind: 'STEP', stepOrder: 2, field: 'KETERANGAN' },
          after: 'Keterangan baru',
          rationale: 'Perbaikan teks yang aman.',
        },
        inputOutputFinding,
        snapshot,
      ),
    ).toThrow();
    expect(() =>
      parseAndCanonicalizeAiRevision(
        {
          target: { kind: 'STEP', stepOrder: 999, field: 'KELUARAN' },
          after: 'Keluaran baru',
          rationale: 'Perbaikan teks yang aman.',
        },
        inputOutputFinding,
        snapshot,
      ),
    ).toThrow();
    expect(() =>
      parseAndCanonicalizeAiRevision(
        {
          target: { kind: 'HEADER', field: 'NOMOR_SOP' },
          after: 'Nomor baru',
          rationale: 'Tidak boleh menyentuh nomor SOP.',
        },
        inputOutputFinding,
        snapshot,
      ),
    ).toThrow();
  });

  it('rejects empty, no-op, overlong, and provider-supplied before values', () => {
    const target = { kind: 'STEP', stepOrder: 2, field: 'KELUARAN' } as const;
    expect(() =>
      parseAndCanonicalizeAiRevision(
        { target, after: '   ', rationale: 'Perbaikan teks yang aman.' },
        inputOutputFinding,
        snapshot,
      ),
    ).toThrow();
    expect(() =>
      parseAndCanonicalizeAiRevision(
        { target, after: ' Hasil verifikasi ', rationale: 'Perbaikan teks yang aman.' },
        inputOutputFinding,
        snapshot,
      ),
    ).toThrow();
    expect(() =>
      parseAndCanonicalizeAiRevision(
        { target, after: 'x'.repeat(2001), rationale: 'Perbaikan teks yang aman.' },
        inputOutputFinding,
        snapshot,
      ),
    ).toThrow();
    expect(() =>
      parseAndCanonicalizeAiRevision(
        {
          target,
          before: 'Nilai dari provider',
          after: 'Keluaran baru',
          rationale: 'Perbaikan teks yang aman.',
        },
        inputOutputFinding,
        snapshot,
      ),
    ).toThrow();
  });

  it('enforces the existing 500-character title limit', () => {
    const titleFinding = finding({ location: { kind: 'HEADER' }, category: 'CLARITY' });
    expect(() =>
      parseAndCanonicalizeAiRevision(
        {
          target: { kind: 'HEADER', field: 'JUDUL' },
          after: 'x'.repeat(501),
          rationale: 'Perbaikan judul.',
        },
        titleFinding,
        snapshot,
      ),
    ).toThrow();
  });

  it('reads canonical values and exposes deterministic target keys', () => {
    expect(readRevisionTargetValue({ kind: 'HEADER', field: 'JUDUL' }, snapshot)).toBe(
      'SOP Pelayanan',
    );
    expect(readRevisionTargetValue({ kind: 'PERINGATAN', itemIndex: 0 }, snapshot)).toBe(
      'Pastikan data benar',
    );
    expect(
      readRevisionTargetValue(
        { kind: 'STEP', stepOrder: 2, field: 'KELENGKAPAN' },
        snapshot,
      ),
    ).toBe('Permohonan diterima');
    expect(revisionTargetKey({ kind: 'STEP', stepOrder: 2, field: 'KELUARAN' })).toBe(
      'STEP:2:KELUARAN',
    );
    expect(revisionTargetKey({ kind: 'PERINGATAN', itemIndex: 0 })).toBe('PERINGATAN:0');
  });
});
