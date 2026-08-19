import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  JenisLangkahProsedur,
  PrismaClient,
  SatuanWaktu,
} from '../src/generated/prisma';

type TemplateStepSeed = {
  urutan: number;
  kegiatan: string;
  jenis: JenisLangkahProsedur;
  kelengkapan: string;
  keluaran: string;
  waktu: number;
  satuanWaktu: SatuanWaktu;
  keterangan: string;
  actorName: string;
  targetYaUrutan?: number;
  targetTidakUrutan?: number;
};

type TemplateSeed = {
  key: string;
  name: string;
  description: string;
  version: number;
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
  steps: TemplateStepSeed[];
};

const SYSTEM_TEMPLATES: TemplateSeed[] = [
  {
    key: 'administrasi-umum',
    name: 'Administrasi Umum',
    description: 'Kerangka SOP untuk proses administrasi internal yang melibatkan penerimaan, pemeriksaan, pemrosesan, dan dokumentasi.',
    version: 1,
    peringatan: ['Pastikan dokumen yang diproses lengkap dan dapat ditelusuri.'],
    kualifikasiPelaksanaan: ['Memahami tata naskah dan proses administrasi unit kerja.'],
    peralatanPerlengkapan: ['Komputer', 'Aplikasi pengolah dokumen'],
    pencatatanPendataan: ['Catat hasil proses dan simpan dokumen pada media penyimpanan resmi.'],
    steps: [
      {
        urutan: 1,
        kegiatan: 'Menerima dokumen atau permintaan administrasi',
        jenis: JenisLangkahProsedur.AWAL_AKHIR,
        kelengkapan: 'Dokumen atau permintaan',
        keluaran: 'Dokumen diterima',
        waktu: 5,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Petugas Administrasi',
      },
      {
        urutan: 2,
        kegiatan: 'Memeriksa kelengkapan dan kesesuaian dokumen',
        jenis: JenisLangkahProsedur.KEGIATAN,
        kelengkapan: 'Dokumen diterima',
        keluaran: 'Hasil pemeriksaan',
        waktu: 15,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Petugas Administrasi',
      },
      {
        urutan: 3,
        kegiatan: 'Memproses dokumen sesuai kebutuhan',
        jenis: JenisLangkahProsedur.KEGIATAN,
        kelengkapan: 'Hasil pemeriksaan',
        keluaran: 'Dokumen hasil proses',
        waktu: 30,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Pelaksana',
      },
      {
        urutan: 4,
        kegiatan: 'Memeriksa dan menyetujui hasil proses',
        jenis: JenisLangkahProsedur.KEGIATAN,
        kelengkapan: 'Dokumen hasil proses',
        keluaran: 'Dokumen disetujui',
        waktu: 15,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Penanggung Jawab',
      },
      {
        urutan: 5,
        kegiatan: 'Mencatat dan menyimpan hasil administrasi',
        jenis: JenisLangkahProsedur.AWAL_AKHIR,
        kelengkapan: 'Dokumen disetujui',
        keluaran: 'Arsip proses',
        waktu: 10,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Petugas Administrasi',
      },
    ],
  },
  {
    key: 'pengelolaan-dokumen',
    name: 'Pengelolaan Dokumen',
    description: 'Kerangka SOP untuk penerimaan, klasifikasi, pengolahan, penyimpanan, dan penemuan kembali dokumen.',
    version: 1,
    peringatan: ['Gunakan klasifikasi dan lokasi penyimpanan yang konsisten.'],
    kualifikasiPelaksanaan: ['Memahami klasifikasi dan pengelolaan dokumen.'],
    peralatanPerlengkapan: ['Komputer', 'Media penyimpanan dokumen'],
    pencatatanPendataan: ['Rekam identitas, lokasi, dan status dokumen agar dapat ditemukan kembali.'],
    steps: [
      {
        urutan: 1,
        kegiatan: 'Menerima dokumen',
        jenis: JenisLangkahProsedur.AWAL_AKHIR,
        kelengkapan: 'Dokumen',
        keluaran: 'Dokumen diterima',
        waktu: 5,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Petugas Dokumen',
      },
      {
        urutan: 2,
        kegiatan: 'Mengidentifikasi dan mengklasifikasikan dokumen',
        jenis: JenisLangkahProsedur.KEGIATAN,
        kelengkapan: 'Dokumen diterima',
        keluaran: 'Dokumen terklasifikasi',
        waktu: 10,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Petugas Dokumen',
      },
      {
        urutan: 3,
        kegiatan: 'Mengolah dan memberi metadata dokumen',
        jenis: JenisLangkahProsedur.KEGIATAN,
        kelengkapan: 'Dokumen terklasifikasi',
        keluaran: 'Dokumen bermetadata',
        waktu: 15,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Pengelola Dokumen',
      },
      {
        urutan: 4,
        kegiatan: 'Menyimpan dokumen pada lokasi yang ditetapkan',
        jenis: JenisLangkahProsedur.KEGIATAN,
        kelengkapan: 'Dokumen bermetadata',
        keluaran: 'Dokumen tersimpan',
        waktu: 10,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Pengelola Dokumen',
      },
      {
        urutan: 5,
        kegiatan: 'Mencatat lokasi dan status penyimpanan',
        jenis: JenisLangkahProsedur.AWAL_AKHIR,
        kelengkapan: 'Dokumen tersimpan',
        keluaran: 'Indeks dokumen',
        waktu: 5,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Petugas Dokumen',
      },
    ],
  },
  {
    key: 'pelayanan',
    name: 'Pelayanan',
    description: 'Kerangka SOP untuk menerima permohonan layanan, memeriksa persyaratan, memproses, dan menyerahkan hasil layanan.',
    version: 1,
    peringatan: ['Jangan memproses permohonan yang persyaratannya belum lengkap.'],
    kualifikasiPelaksanaan: ['Memahami persyaratan dan standar layanan yang berlaku.'],
    peralatanPerlengkapan: ['Komputer', 'Formulir atau sistem layanan'],
    pencatatanPendataan: ['Catat permohonan, hasil pemeriksaan, dan penyelesaian layanan.'],
    steps: [
      {
        urutan: 1,
        kegiatan: 'Menerima permohonan layanan',
        jenis: JenisLangkahProsedur.AWAL_AKHIR,
        kelengkapan: 'Permohonan dan persyaratan',
        keluaran: 'Permohonan diterima',
        waktu: 5,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Petugas Layanan',
      },
      {
        urutan: 2,
        kegiatan: 'Memeriksa kelengkapan persyaratan',
        jenis: JenisLangkahProsedur.KEPUTUSAN,
        kelengkapan: 'Permohonan diterima',
        keluaran: 'Hasil pemeriksaan',
        waktu: 10,
        satuanWaktu: SatuanWaktu.m,
        keterangan: 'Jika lengkap lanjut diproses; jika belum lengkap dikembalikan untuk dilengkapi.',
        actorName: 'Petugas Layanan',
        targetYaUrutan: 3,
        targetTidakUrutan: 1,
      },
      {
        urutan: 3,
        kegiatan: 'Memproses permohonan layanan',
        jenis: JenisLangkahProsedur.KEGIATAN,
        kelengkapan: 'Persyaratan lengkap',
        keluaran: 'Hasil layanan',
        waktu: 30,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Pelaksana Layanan',
      },
      {
        urutan: 4,
        kegiatan: 'Memeriksa hasil layanan',
        jenis: JenisLangkahProsedur.KEGIATAN,
        kelengkapan: 'Hasil layanan',
        keluaran: 'Hasil terverifikasi',
        waktu: 15,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Penanggung Jawab Layanan',
      },
      {
        urutan: 5,
        kegiatan: 'Menyerahkan hasil layanan dan mencatat penyelesaian',
        jenis: JenisLangkahProsedur.AWAL_AKHIR,
        kelengkapan: 'Hasil terverifikasi',
        keluaran: 'Layanan selesai',
        waktu: 5,
        satuanWaktu: SatuanWaktu.m,
        keterangan: '',
        actorName: 'Petugas Layanan',
      },
    ],
  },
];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi untuk database seed`);
  return value;
}

function requiredPort(): number {
  const value = Number(process.env.DATABASE_PORT ?? '3306');
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error('DATABASE_PORT tidak valid untuk database seed');
  }
  return value;
}

async function main(): Promise<void> {
  const adapter = new PrismaMariaDb({
    host: required('DATABASE_HOST'),
    port: requiredPort(),
    user: required('DATABASE_USER'),
    password: required('DATABASE_PASSWORD'),
    database: required('DATABASE_NAME'),
    connectionLimit: 2,
    connectTimeout: 15_000,
    allowPublicKeyRetrieval: true,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    for (const template of SYSTEM_TEMPLATES) {
      await prisma.$transaction(async (tx) => {
        const saved = await tx.sopTemplate.upsert({
          where: { key: template.key },
          update: {
            name: template.name,
            description: template.description,
            version: template.version,
            isActive: true,
            peringatan: template.peringatan,
            kualifikasiPelaksanaan: template.kualifikasiPelaksanaan,
            peralatanPerlengkapan: template.peralatanPerlengkapan,
            pencatatanPendataan: template.pencatatanPendataan,
          },
          create: {
            key: template.key,
            name: template.name,
            description: template.description,
            version: template.version,
            isActive: true,
            peringatan: template.peringatan,
            kualifikasiPelaksanaan: template.kualifikasiPelaksanaan,
            peralatanPerlengkapan: template.peralatanPerlengkapan,
            pencatatanPendataan: template.pencatatanPendataan,
          },
          select: { templateId: true },
        });

        await tx.sopTemplateStep.deleteMany({ where: { templateId: saved.templateId } });
        await tx.sopTemplateStep.createMany({
          data: template.steps.map((step) => ({
            templateId: saved.templateId,
            urutan: step.urutan,
            kegiatan: step.kegiatan,
            jenis: step.jenis,
            kelengkapan: step.kelengkapan,
            keluaran: step.keluaran,
            waktu: step.waktu,
            satuanWaktu: step.satuanWaktu,
            keterangan: step.keterangan,
            actorName: step.actorName,
            targetYaUrutan: step.targetYaUrutan,
            targetTidakUrutan: step.targetTidakUrutan,
          })),
        });
      });
    }

    process.stdout.write(`Seed template sistem selesai: ${SYSTEM_TEMPLATES.length} template.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Database seed gagal: ${message}\n`);
  process.exitCode = 1;
});
