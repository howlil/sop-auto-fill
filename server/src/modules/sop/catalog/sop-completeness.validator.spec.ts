import { JenisLangkahProsedur } from '../../../generated/prisma';
import { collectSopWorkbenchCompletenessIssues } from './sop-completeness.validator';

function completeRow(): any {
  return {
    sop: { judul: 'SOP Pengujian' },
    nomorSOP: '001/SOP',
    namaLembaga: 'Biro Organisasi',
    dasarHukum: [{}],
    relasiSopKeluar: [{}],
    lampiranPeringatan: [{ teks: 'Peringatan' }],
    lampiranKualifikasiPelaksanaan: [{ teks: 'Kualifikasi' }],
    lampiranPeralatanPerlengkapan: [{ teks: 'Peralatan' }],
    lampiranPencatatanPendataan: [{ teks: 'Pencatatan' }],
    swimlanes: [{}],
    langkahSOP: [
      {
        urutan: 1,
        kegiatan: 'Menerima berkas',
        kelengkapan: 'Berkas',
        keluaran: 'Berkas diterima',
        keterangan: 'Lanjut',
        pelaksanaId: 'pelaksana-1',
        jenis: JenisLangkahProsedur.KEGIATAN,
        langkahSelanjutnyaYaId: null,
        langkahSelanjutnyaTidakId: null,
      },
    ],
  };
}

describe('SOP workbench completeness', () => {
  it('menerima muatan authoring workspace yang lengkap', () => {
    expect(collectSopWorkbenchCompletenessIssues(completeRow())).toEqual([]);
  });

  it('melaporkan field inti yang kosong', () => {
    const row = completeRow();
    row.sop.judul = ' ';
    row.nomorSOP = '';
    row.namaLembaga = '';
    row.dasarHukum = [];
    row.relasiSopKeluar = [];

    expect(collectSopWorkbenchCompletenessIssues(row)).toEqual(
      expect.arrayContaining([
        'Judul SOP wajib diisi',
        'Nomor SOP wajib diisi',
        'Nama lembaga wajib diisi',
        'Minimal satu dasar hukum wajib dipilih',
        'Minimal satu SOP terkait wajib dipilih',
      ]),
    );
  });

  it('mewajibkan kedua cabang pada langkah keputusan', () => {
    const row = completeRow();
    row.langkahSOP[0] = {
      ...row.langkahSOP[0],
      jenis: JenisLangkahProsedur.KEPUTUSAN,
      langkahSelanjutnyaYaId: null,
      langkahSelanjutnyaTidakId: '',
    };

    const issues = collectSopWorkbenchCompletenessIssues(row);
    expect(issues).toEqual(
      expect.arrayContaining([
        'Langkah urutan 1: cabang "Ya" wajib menunjuk langkah berikutnya',
        'Langkah urutan 1: cabang "Tidak" wajib menunjuk langkah berikutnya',
      ]),
    );
  });

  it('mewajibkan pelaksana dan daftar langkah', () => {
    const row = completeRow();
    row.swimlanes = [];
    row.langkahSOP = [];

    expect(collectSopWorkbenchCompletenessIssues(row)).toEqual(
      expect.arrayContaining([
        'Minimal satu kolom pelaksana wajib ada',
        'Minimal satu langkah prosedur wajib ada',
      ]),
    );
  });
});
