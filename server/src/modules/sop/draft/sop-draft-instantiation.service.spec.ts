import { BagianSOP, JenisLangkahProsedur, SatuanWaktu, StatusSOP } from '../../../generated/prisma';
import { appendOrCreateLogSession } from '../collaboration/log-edit-session.helper';
import { SopDraftInstantiationService } from './sop-draft-instantiation.service';
import type { SopDraftDefinition } from './sop-draft.types';

jest.mock('../collaboration/log-edit-session.helper', () => ({
  appendOrCreateLogSession: jest.fn().mockResolvedValue(undefined),
}));

const definition: SopDraftDefinition = {
  peringatan: ['Periksa kelengkapan'],
  kualifikasiPelaksanaan: ['Memahami layanan'],
  peralatanPerlengkapan: ['Komputer'],
  pencatatanPendataan: ['Register layanan'],
  actorNames: ['Petugas Layanan', 'Verifikator'],
  steps: [
    {
      urutan: 1,
      kegiatan: 'Menerima permohonan',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      kelengkapan: 'Permohonan',
      keluaran: 'Permohonan diterima',
      waktu: 5,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Catat permohonan',
      actorName: 'Petugas Layanan',
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
    {
      urutan: 2,
      kegiatan: 'Memeriksa permohonan',
      jenis: JenisLangkahProsedur.KEPUTUSAN,
      kelengkapan: 'Permohonan diterima',
      keluaran: 'Hasil verifikasi',
      waktu: 10,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Tentukan kelengkapan',
      actorName: 'Verifikator',
      targetYaUrutan: 3,
      targetTidakUrutan: 1,
    },
    {
      urutan: 3,
      kegiatan: 'Menyerahkan hasil',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      kelengkapan: 'Hasil verifikasi',
      keluaran: 'Layanan selesai',
      waktu: 5,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Serahkan hasil',
      actorName: 'Petugas Layanan',
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
  ],
};

function makeService() {
  const tx = {
    sOP: {
      create: jest.fn().mockResolvedValue({ sopId: 'sop-1' }),
    },
    detailSOP: {
      create: jest.fn().mockResolvedValue({ detailSopId: 'detail-1' }),
    },
    pelaksana: {
      findMany: jest.fn().mockResolvedValue([
        { pelaksanaId: 'actor-existing', nama: ' petugas layanan ' },
      ]),
      upsert: jest.fn().mockResolvedValue({
        pelaksanaId: 'actor-new',
        nama: 'Verifikator',
      }),
    },
    detailSOPPelaksana: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    lampiranPeringatan: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    lampiranKualifikasiPelaksanaan: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    lampiranPeralatanPerlengkapan: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    lampiranPencatatanPendataan: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    langkahSOP: {
      create: jest
        .fn()
        .mockResolvedValueOnce({ langkahSopId: 'step-1' })
        .mockResolvedValueOnce({ langkahSopId: 'step-2' })
        .mockResolvedValueOnce({ langkahSopId: 'step-3' }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };

  return { service: new SopDraftInstantiationService(prisma as any), prisma, tx };
}

describe('SopDraftInstantiationService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('membuat draft atomik, reuse/create aktor deterministik, lampiran, langkah, routing, dan log awal', async () => {
    const { service, prisma, tx } = makeService();

    await expect(
      service.instantiate({
        definition,
        workspaceId: 'workspace-1',
        userId: 'user-1',
        judul: 'SOP Pelayanan',
        nomorSop: 'SOP-001',
        namaLembaga: 'Unit Pelayanan',
      }),
    ).resolves.toEqual({
      sopId: 'sop-1',
      detailSopId: 'detail-1',
      workspaceId: 'workspace-1',
      status: StatusSOP.DRAFT,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.sOP.create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'workspace-1',
        judul: 'SOP Pelayanan',
        status: StatusSOP.DRAFT,
      },
      select: { sopId: true },
    });
    expect(tx.detailSOP.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sopId: 'sop-1',
        versi: 1,
        nomorSOP: 'SOP-001',
        namaLembaga: 'Unit Pelayanan',
        dibuatOlehId: 'user-1',
        terakhirDieditOlehId: 'user-1',
      }),
      select: { detailSopId: true },
    });

    expect(tx.pelaksana.upsert).toHaveBeenCalledTimes(1);
    expect(tx.pelaksana.upsert).toHaveBeenCalledWith({
      where: {
        workspaceId_nama: { workspaceId: 'workspace-1', nama: 'Verifikator' },
      },
      update: {},
      create: { workspaceId: 'workspace-1', nama: 'Verifikator' },
      select: { pelaksanaId: true, nama: true },
    });
    expect(tx.detailSOPPelaksana.createMany).toHaveBeenCalledWith({
      data: [
        { detailSopId: 'detail-1', pelaksanaId: 'actor-existing', urutan: 0 },
        { detailSopId: 'detail-1', pelaksanaId: 'actor-new', urutan: 1 },
      ],
    });

    expect(tx.lampiranPeringatan.createMany).toHaveBeenCalledWith({
      data: [{ detailSopId: 'detail-1', teks: 'Periksa kelengkapan' }],
    });
    expect(tx.lampiranKualifikasiPelaksanaan.createMany).toHaveBeenCalledTimes(1);
    expect(tx.lampiranPeralatanPerlengkapan.createMany).toHaveBeenCalledTimes(1);
    expect(tx.lampiranPencatatanPendataan.createMany).toHaveBeenCalledTimes(1);

    expect(tx.langkahSOP.create).toHaveBeenCalledTimes(3);
    expect(tx.langkahSOP.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          urutan: 2,
          pelaksanaId: 'actor-new',
          jenis: JenisLangkahProsedur.KEPUTUSAN,
        }),
      }),
    );
    expect(tx.langkahSOP.update).toHaveBeenCalledTimes(1);
    expect(tx.langkahSOP.update).toHaveBeenCalledWith({
      where: { langkahSopId: 'step-2' },
      data: {
        langkahSelanjutnyaYaId: 'step-3',
        langkahSelanjutnyaTidakId: 'step-1',
      },
    });

    expect(appendOrCreateLogSession).toHaveBeenCalledWith({
      tx,
      detailSopId: 'detail-1',
      penggunaId: 'user-1',
      bagian: BagianSOP.HEADER,
      fields: ['create', 'pelaksana', 'langkah'],
      discrete: true,
    });
  });

  it('tidak membuat createMany lampiran untuk koleksi kosong', async () => {
    const { service, tx } = makeService();
    const emptyLampiran: SopDraftDefinition = {
      ...definition,
      peringatan: [],
      kualifikasiPelaksanaan: [],
      peralatanPerlengkapan: [],
      pencatatanPendataan: [],
    };

    await service.instantiate({
      definition: emptyLampiran,
      workspaceId: 'workspace-1',
      userId: 'user-1',
      judul: 'SOP Pelayanan',
      nomorSop: 'SOP-002',
      namaLembaga: 'Unit Pelayanan',
    });

    expect(tx.lampiranPeringatan.createMany).not.toHaveBeenCalled();
    expect(tx.lampiranKualifikasiPelaksanaan.createMany).not.toHaveBeenCalled();
    expect(tx.lampiranPeralatanPerlengkapan.createMany).not.toHaveBeenCalled();
    expect(tx.lampiranPencatatanPendataan.createMany).not.toHaveBeenCalled();
  });
});
