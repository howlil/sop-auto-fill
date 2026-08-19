import { Injectable } from '@nestjs/common';
import { JenisLangkahProsedur, SatuanWaktu } from '../../../../generated/prisma';
import type { AiDraftProvider } from './ai-draft-provider';
import type { AiDraftGenerationInput, AiDraftProviderOutput } from '../sop-ai-draft.types';

@Injectable()
export class FakeAiDraftProvider implements AiDraftProvider {
  async generate(_input: AiDraftGenerationInput): Promise<AiDraftProviderOutput> {
    return {
      suggestedTitle: 'SOP Pelayanan Permohonan',
      peringatan: ['Pastikan data pemohon telah diverifikasi'],
      kualifikasiPelaksanaan: ['Memahami alur pelayanan'],
      peralatanPerlengkapan: ['Komputer'],
      pencatatanPendataan: ['Register pelayanan'],
      steps: [
        {
          urutan: 1,
          kegiatan: 'Menerima permohonan',
          jenis: JenisLangkahProsedur.AWAL_AKHIR,
          kelengkapan: 'Formulir permohonan',
          keluaran: 'Permohonan diterima',
          waktu: 5,
          satuanWaktu: SatuanWaktu.m,
          keterangan: 'Catat permohonan yang masuk',
          actorName: 'Petugas Layanan',
          targetYaUrutan: null,
          targetTidakUrutan: null,
        },
        {
          urutan: 2,
          kegiatan: 'Memverifikasi kelengkapan',
          jenis: JenisLangkahProsedur.KEPUTUSAN,
          kelengkapan: 'Permohonan diterima',
          keluaran: 'Hasil verifikasi',
          waktu: 10,
          satuanWaktu: SatuanWaktu.m,
          keterangan: 'Jika tidak lengkap kembalikan ke penerimaan',
          actorName: 'Verifikator',
          targetYaUrutan: 3,
          targetTidakUrutan: 1,
        },
        {
          urutan: 3,
          kegiatan: 'Menyerahkan hasil pelayanan',
          jenis: JenisLangkahProsedur.AWAL_AKHIR,
          kelengkapan: 'Hasil verifikasi',
          keluaran: 'Pelayanan selesai',
          waktu: 5,
          satuanWaktu: SatuanWaktu.m,
          keterangan: 'Serahkan hasil kepada pemohon',
          actorName: 'Petugas Layanan',
          targetYaUrutan: null,
          targetTidakUrutan: null,
        },
      ],
    };
  }
}
