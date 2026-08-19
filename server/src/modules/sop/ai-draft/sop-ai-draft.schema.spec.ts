import { UnprocessableEntityException } from '@nestjs/common';
import { JenisLangkahProsedur, SatuanWaktu } from '../../../generated/prisma';
import { parseAndCanonicalizeAiDraft } from './sop-ai-draft.schema';

function validOutput() {
  return {
    suggestedTitle: ' SOP Verifikasi Permohonan ',
    peringatan: [' Pastikan dokumen lengkap ', '   '],
    kualifikasiPelaksanaan: [' Memahami proses layanan '],
    peralatanPerlengkapan: [' Komputer '],
    pencatatanPendataan: [' Register permohonan '],
    steps: [
      {
        urutan: 30,
        kegiatan: ' Memeriksa kelengkapan ',
        jenis: JenisLangkahProsedur.KEPUTUSAN,
        kelengkapan: ' Dokumen permohonan ',
        keluaran: ' Hasil pemeriksaan ',
        waktu: 10,
        satuanWaktu: SatuanWaktu.m,
        keterangan: ' Tentukan lengkap atau tidak ',
        actorName: ' Verifikator ',
        targetYaUrutan: 50,
        targetTidakUrutan: 10,
      },
      {
        urutan: 10,
        kegiatan: ' Menerima permohonan ',
        jenis: JenisLangkahProsedur.AWAL_AKHIR,
        kelengkapan: ' Formulir ',
        keluaran: ' Permohonan diterima ',
        waktu: 5,
        satuanWaktu: SatuanWaktu.m,
        keterangan: ' Catat permohonan ',
        actorName: ' Petugas Layanan ',
        targetYaUrutan: null,
        targetTidakUrutan: null,
      },
      {
        urutan: 50,
        kegiatan: ' Menyerahkan hasil ',
        jenis: JenisLangkahProsedur.AWAL_AKHIR,
        kelengkapan: ' Hasil pemeriksaan ',
        keluaran: ' Layanan selesai ',
        waktu: 5,
        satuanWaktu: SatuanWaktu.m,
        keterangan: ' Serahkan hasil ',
        actorName: 'petugas layanan',
        targetYaUrutan: null,
        targetTidakUrutan: null,
      },
    ],
  };
}

function expectInvalid(mutator: (value: ReturnType<typeof validOutput>) => void) {
  const value = validOutput();
  mutator(value);
  expect(() => parseAndCanonicalizeAiDraft(value)).toThrow(UnprocessableEntityException);
}

describe('parseAndCanonicalizeAiDraft', () => {
  it('trim, menghapus lampiran kosong, mengurutkan langkah, remap routing, dan dedupe aktor first-use', () => {
    const result = parseAndCanonicalizeAiDraft(validOutput());

    expect(result.suggestedTitle).toBe('SOP Verifikasi Permohonan');
    expect(result.peringatan).toEqual(['Pastikan dokumen lengkap']);
    expect(result.kualifikasiPelaksanaan).toEqual(['Memahami proses layanan']);
    expect(result.peralatanPerlengkapan).toEqual(['Komputer']);
    expect(result.pencatatanPendataan).toEqual(['Register permohonan']);
    expect(result.actors).toEqual(['Petugas Layanan', 'Verifikator']);
    expect(result.steps.map((step) => step.urutan)).toEqual([1, 2, 3]);
    expect(result.steps[1]).toEqual(
      expect.objectContaining({
        kegiatan: 'Memeriksa kelengkapan',
        actorName: 'Verifikator',
        targetYaUrutan: 3,
        targetTidakUrutan: 1,
      }),
    );
    expect(result.steps[2].actorName).toBe('Petugas Layanan');
  });

  it('menolak jumlah langkah di luar 2..25', () => {
    expectInvalid((value) => {
      value.steps = [value.steps[0]];
    });
    expectInvalid((value) => {
      value.steps = Array.from({ length: 26 }, (_, index) => ({
        ...value.steps[0],
        urutan: index + 1,
        jenis: JenisLangkahProsedur.KEGIATAN,
        targetYaUrutan: null,
        targetTidakUrutan: null,
      }));
    });
  });

  it('menolak order duplikat/nonpositif dan target yang tidak ada', () => {
    expectInvalid((value) => {
      value.steps[1].urutan = value.steps[0].urutan;
    });
    expectInvalid((value) => {
      value.steps[0].urutan = 0;
    });
    expectInvalid((value) => {
      value.steps[0].targetYaUrutan = 999;
    });
  });

  it('menolak waktu non-integer atau di luar 1..525600', () => {
    expectInvalid((value) => {
      value.steps[0].waktu = 0;
    });
    expectInvalid((value) => {
      value.steps[0].waktu = 525601;
    });
    expectInvalid((value) => {
      value.steps[0].waktu = 1.5;
    });
  });

  it('menolak field wajib kosong dan text yang melebihi contract', () => {
    expectInvalid((value) => {
      value.steps[0].actorName = '   ';
    });
    expectInvalid((value) => {
      value.steps[0].kegiatan = 'x'.repeat(501);
    });
    expectInvalid((value) => {
      value.suggestedTitle = 'x';
    });
    expectInvalid((value) => {
      value.peringatan = Array.from({ length: 21 }, () => 'item');
    });
  });

  it('menolak enum provider yang tidak dikenal', () => {
    expectInvalid((value) => {
      value.steps[0].jenis = 'UNKNOWN' as JenisLangkahProsedur;
    });
    expectInvalid((value) => {
      value.steps[0].satuanWaktu = 'minute' as SatuanWaktu;
    });
  });

  it('menerapkan invariant routing keputusan dan non-keputusan', () => {
    expectInvalid((value) => {
      value.steps[0].targetYaUrutan = null;
      value.steps[0].targetTidakUrutan = null;
    });
    expectInvalid((value) => {
      value.steps[0].targetTidakUrutan = value.steps[0].targetYaUrutan;
    });
    expectInvalid((value) => {
      value.steps[1].targetYaUrutan = 30;
    });
  });
});
