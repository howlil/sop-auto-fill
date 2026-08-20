import { JenisLangkahProsedur, SatuanWaktu, StatusSOP } from '../../../generated/prisma';
import { SopAiSnapshotRepository } from './sop-ai-snapshot.repository';

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
  return { repository: new SopAiSnapshotRepository(prisma as any), prisma };
}

const dbRow = {
  detailSopId: 'detail-1',
  versi: 2,
  nomorSOP: '001/SOP',
  namaLembaga: 'Unit Pelayanan',
  sop: {
    judul: 'SOP Pelayanan',
    status: StatusSOP.DRAFT,
    workspace: { ownerId: 'owner-1' },
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
    { pelaksanaId: 'actor-db-1', urutan: 1, pelaksana: { nama: 'Petugas' } },
    { pelaksanaId: 'actor-db-2', urutan: 2, pelaksana: { nama: 'Verifikator' } },
  ],
  langkahSOP: [
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
      pelaksana: { nama: 'Petugas' },
      langkahSelanjutnyaYaId: null,
      langkahSelanjutnyaTidakId: null,
    },
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
      pelaksana: { nama: 'Verifikator' },
      langkahSelanjutnyaYaId: 'step-db-3',
      langkahSelanjutnyaTidakId: 'step-db-1',
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
      pelaksana: { nama: 'Petugas' },
      langkahSelanjutnyaYaId: null,
      langkahSelanjutnyaTidakId: null,
    },
  ],
};

describe('SopAiSnapshotRepository', () => {
  it('loads one persisted authoritative SOP snapshot using deterministic ordering', async () => {
    const { repository, prisma } = makeRepository();
    prisma.detailSOP.findUnique.mockResolvedValue(dbRow);

    const result = await repository.findContext('detail-1');

    expect(prisma.detailSOP.findUnique).toHaveBeenCalledWith({
      where: { detailSopId: 'detail-1' },
      include: {
        sop: { include: { workspace: true } },
        lampiranPeringatan: { orderBy: { createdAt: 'asc' } },
        lampiranKualifikasiPelaksanaan: { orderBy: { createdAt: 'asc' } },
        lampiranPeralatanPerlengkapan: { orderBy: { createdAt: 'asc' } },
        lampiranPencatatanPendataan: { orderBy: { createdAt: 'asc' } },
        swimlanes: {
          orderBy: { urutan: 'asc' },
          include: { pelaksana: true },
        },
        langkahSOP: {
          orderBy: { urutan: 'asc' },
          include: { pelaksana: true },
        },
      },
    });
    expect(result?.ownerId).toBe('owner-1');
    expect(result?.status).toBe(StatusSOP.DRAFT);
    expect(result?.snapshot).toEqual(
      expect.objectContaining({
        detailSopId: 'detail-1',
        versi: 2,
        judul: 'SOP Pelayanan',
        nomorSop: '001/SOP',
        namaLembaga: 'Unit Pelayanan',
        peringatan: ['Pastikan data benar'],
      }),
    );
    expect(result?.snapshot.actors).toEqual([
      { pelaksanaId: 'actor-db-1', name: 'Petugas', order: 1 },
      { pelaksanaId: 'actor-db-2', name: 'Verifikator', order: 2 },
    ]);
    expect(result?.snapshot.steps[1]).toEqual(
      expect.objectContaining({
        langkahSopId: 'step-db-2',
        urutan: 2,
        targetYaUrutan: 3,
        targetTidakUrutan: 1,
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.detailSOP.create).not.toHaveBeenCalled();
    expect(prisma.detailSOP.update).not.toHaveBeenCalled();
    expect(prisma.detailSOP.delete).not.toHaveBeenCalled();
  });

  it('returns null when detail SOP is missing', async () => {
    const { repository, prisma } = makeRepository();
    prisma.detailSOP.findUnique.mockResolvedValue(null);

    await expect(repository.findContext('missing')).resolves.toBeNull();
  });
});
