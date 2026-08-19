import { JenisLangkahProsedur, SatuanWaktu, StatusSOP } from '../../../generated/prisma';
import { SopAiReviewRepository } from './sop-ai-review.repository';

function makeRepository() {
  const prisma = {
    detailSOP: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    sOP: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn(),
  };
  return { repository: new SopAiReviewRepository(prisma as any), prisma };
}

const dbRow = {
  detailSopId: 'detail-1',
  versi: 2,
  nomorSOP: '001/SOP',
  namaLembaga: 'Unit Pelayanan',
  sop: {
    judul: 'SOP Pelayanan',
    status: StatusSOP.DRAFT,
    workspace: { ownerId: 'user-1' },
  },
  lampiranPeringatan: [
    { teks: 'Pastikan data benar', createdAt: new Date('2026-08-20T00:00:00Z') },
  ],
  lampiranKualifikasiPelaksanaan: [
    { teks: 'Memahami layanan', createdAt: new Date('2026-08-20T00:00:00Z') },
  ],
  lampiranPeralatanPerlengkapan: [
    { teks: 'Komputer', createdAt: new Date('2026-08-20T00:00:00Z') },
  ],
  lampiranPencatatanPendataan: [
    { teks: 'Register', createdAt: new Date('2026-08-20T00:00:00Z') },
  ],
  swimlanes: [
    { pelaksanaId: 'actor-db-2', urutan: 2, pelaksana: { nama: 'Verifikator' } },
    { pelaksanaId: 'actor-db-1', urutan: 1, pelaksana: { nama: 'Petugas' } },
  ],
  langkahSOP: [
    {
      langkahSopId: 'step-db-2',
      urutan: 2,
      kegiatan: 'Memverifikasi permohonan',
      jenis: JenisLangkahProsedur.KEPUTUSAN,
      kelengkapan: 'Permohonan diterima',
      keluaran: 'Hasil verifikasi',
      waktu: 10,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Tentukan kelengkapan',
      pelaksanaId: 'actor-db-2',
      pelaksana: { nama: 'Verifikator' },
      langkahSelanjutnyaYaId: 'step-db-3',
      langkahSelanjutnyaTidakId: 'step-db-1',
    },
    {
      langkahSopId: 'step-db-1',
      urutan: 1,
      kegiatan: 'Menerima permohonan',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      kelengkapan: 'Formulir',
      keluaran: 'Permohonan diterima',
      waktu: 5,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Catat',
      pelaksanaId: 'actor-db-1',
      pelaksana: { nama: 'Petugas' },
      langkahSelanjutnyaYaId: null,
      langkahSelanjutnyaTidakId: null,
    },
    {
      langkahSopId: 'step-db-3',
      urutan: 3,
      kegiatan: 'Menyerahkan hasil',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      kelengkapan: 'Hasil verifikasi',
      keluaran: 'Layanan selesai',
      waktu: 5,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Serahkan hasil',
      pelaksanaId: 'actor-db-1',
      pelaksana: { nama: 'Petugas' },
      langkahSelanjutnyaYaId: null,
      langkahSelanjutnyaTidakId: null,
    },
  ],
};

describe('SopAiReviewRepository', () => {
  it('memuat dan memetakan snapshot persisted secara authoritative', async () => {
    const { repository, prisma } = makeRepository();
    prisma.detailSOP.findUnique.mockResolvedValue(dbRow);

    await expect(repository.findReviewContext('detail-1')).resolves.toEqual({
      ownerId: 'user-1',
      status: StatusSOP.DRAFT,
      snapshot: {
        detailSopId: 'detail-1',
        versi: 2,
        judul: 'SOP Pelayanan',
        nomorSop: '001/SOP',
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
          expect.objectContaining({
            langkahSopId: 'step-db-1',
            urutan: 1,
            actorName: 'Petugas',
            targetYaUrutan: null,
            targetTidakUrutan: null,
          }),
          expect.objectContaining({
            langkahSopId: 'step-db-2',
            urutan: 2,
            actorName: 'Verifikator',
            targetYaUrutan: 3,
            targetTidakUrutan: 1,
          }),
          expect.objectContaining({
            langkahSopId: 'step-db-3',
            urutan: 3,
            actorName: 'Petugas',
          }),
        ],
      },
    });

    expect(prisma.detailSOP.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { detailSopId: 'detail-1' },
        include: expect.objectContaining({
          sop: { include: { workspace: true } },
          lampiranPeringatan: expect.any(Object),
          lampiranKualifikasiPelaksanaan: expect.any(Object),
          lampiranPeralatanPerlengkapan: expect.any(Object),
          lampiranPencatatanPendataan: expect.any(Object),
          swimlanes: expect.objectContaining({ include: { pelaksana: true } }),
          langkahSOP: expect.objectContaining({ include: { pelaksana: true } }),
        }),
      }),
    );
  });

  it('mengembalikan null ketika detail SOP tidak ditemukan', async () => {
    const { repository, prisma } = makeRepository();
    prisma.detailSOP.findUnique.mockResolvedValue(null);

    await expect(repository.findReviewContext('missing')).resolves.toBeNull();
  });

  it('tidak menggunakan jalur mutation atau transaction', async () => {
    const { repository, prisma } = makeRepository();
    prisma.detailSOP.findUnique.mockResolvedValue(dbRow);

    await repository.findReviewContext('detail-1');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.detailSOP.create).not.toHaveBeenCalled();
    expect(prisma.detailSOP.update).not.toHaveBeenCalled();
    expect(prisma.detailSOP.delete).not.toHaveBeenCalled();
    expect(prisma.sOP.create).not.toHaveBeenCalled();
    expect(prisma.sOP.update).not.toHaveBeenCalled();
    expect(prisma.sOP.delete).not.toHaveBeenCalled();
  });
});
