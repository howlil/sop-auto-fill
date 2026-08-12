import { JenisDiagram, JenisLangkahProsedur, StatusSOP } from '../../../generated/prisma';
import { SopCatalogRepository } from './sop-catalog.repository';

function makeRepository() {
  const prisma = {
    sOP: { findMany: jest.fn(), update: jest.fn() },
    detailSOP: { findUnique: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  return { repository: new SopCatalogRepository(prisma as any), prisma };
}

const dbRow = {
  sopId: 'sop-1',
  workspaceId: 'workspace-1',
  judul: 'SOP Pengujian',
  status: StatusSOP.DRAFT,
  updatedAt: new Date('2026-08-02T00:00:00.000Z'),
  detailSops: [
    {
      detailSopId: 'detail-1',
      nomorSOP: '001/SOP',
      versi: 1,
      updatedAt: new Date('2026-08-02T00:00:00.000Z'),
      dibuatOleh: { name: 'Pembuat' },
      terakhirDieditOleh: { name: 'Editor' },
      dasarHukum: [{ peraturanId: 'peraturan-1' }],
    },
  ],
};

describe('SopCatalogRepository workspace model', () => {
  it('mengambil dan memetakan SOP berdasarkan workspace', async () => {
    const { repository, prisma } = makeRepository();
    prisma.sOP.findMany.mockResolvedValue([dbRow]);

    await expect(repository.findDaftarByWorkspaceId('workspace-1')).resolves.toEqual([
      {
        sopId: 'sop-1',
        workspaceId: 'workspace-1',
        judul: 'SOP Pengujian',
        status: StatusSOP.DRAFT,
        versionCount: 1,
        detail: {
          detailSopId: 'detail-1',
          nomorSOP: '001/SOP',
          versi: 1,
          updatedAt: new Date('2026-08-02T00:00:00.000Z'),
          pembuatNama: 'Pembuat',
          editorNama: 'Editor',
          peraturanId: 'peraturan-1',
        },
      },
    ]);

    expect(prisma.sOP.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'workspace-1' } }),
    );
  });

  it('menerapkan filter status pada hasil workspace', async () => {
    const { repository, prisma } = makeRepository();
    prisma.sOP.findMany.mockResolvedValue([dbRow]);

    await expect(
      repository.findDaftarByWorkspaceId('workspace-1', { status: StatusSOP.COMPLETED }),
    ).resolves.toEqual([]);
  });

  it('menerapkan filter tanggal terhadap detail terbaru', async () => {
    const { repository, prisma } = makeRepository();
    prisma.sOP.findMany.mockResolvedValue([dbRow]);

    await expect(
      repository.findDaftarByWorkspaceId('workspace-1', { tanggalDari: '2026-08-03' }),
    ).resolves.toEqual([]);
    await expect(
      repository.findDaftarByWorkspaceId('workspace-1', { tanggalSampai: '2026-08-02' }),
    ).resolves.toHaveLength(1);
  });

  it('meng-clone isi authoring, graph langkah, dan override diagram ke versi baru', async () => {
    const { repository, prisma } = makeRepository();
    const source = {
      detailSopId: 'detail-1',
      sopId: 'sop-1',
      nomorSOP: '001/SOP',
      namaLembaga: 'Biro Organisasi',
      sop: { status: StatusSOP.COMPLETED },
      lampiranPeringatan: [{ teks: 'Waspada' }],
      lampiranKualifikasiPelaksanaan: [{ teks: 'Memahami proses' }],
      lampiranPeralatanPerlengkapan: [{ teks: 'Komputer' }],
      lampiranPencatatanPendataan: [{ teks: 'Arsip digital' }],
      dasarHukum: [{ peraturanId: 'peraturan-1' }],
      swimlanes: [{ pelaksanaId: 'pelaksana-1', urutan: 1 }],
      relasiSopKeluar: [{ detailSopTerkaitId: 'detail-terkait' }],
      relasiSopMasuk: [],
      langkahSOP: [
        {
          langkahSopId: 'step-old-1',
          urutan: 1,
          kegiatan: 'Periksa',
          jenis: JenisLangkahProsedur.KEPUTUSAN,
          kelengkapan: 'Berkas',
          keluaran: 'Keputusan',
          waktu: 1,
          satuanWaktu: null,
          keterangan: 'Periksa berkas',
          pelaksanaId: 'pelaksana-1',
          langkahSelanjutnyaYaId: 'step-old-2',
          langkahSelanjutnyaTidakId: null,
        },
        {
          langkahSopId: 'step-old-2',
          urutan: 2,
          kegiatan: 'Selesai',
          jenis: JenisLangkahProsedur.KEGIATAN,
          kelengkapan: 'Keputusan',
          keluaran: 'Selesai',
          waktu: 1,
          satuanWaktu: null,
          keterangan: 'Selesai',
          pelaksanaId: 'pelaksana-1',
          langkahSelanjutnyaYaId: null,
          langkahSelanjutnyaTidakId: null,
        },
      ],
      konfigurasiDiagram: [
        {
          jenis: JenisDiagram.FLOWCHART,
          layoutSeed: 9,
          overridePanah: [
            {
              dariLangkahSopId: 'step-old-1',
              keLangkahSopId: 'step-old-2',
              cabang: 'YA',
              sSide: 'right',
              eSide: 'left',
              startX: 1,
              startY: 2,
              endX: 3,
              endY: 4,
              titikTekuk: [{ urutan: 0, x: 2, y: 3 }],
            },
          ],
          overrideLabel: [{ kunciLabel: 'edge-1', posisiX: 11, posisiY: 12 }],
        },
      ],
    };
    prisma.detailSOP.findUnique.mockResolvedValue(source);
    prisma.detailSOP.findFirst.mockResolvedValue({ detailSopId: 'detail-1', versi: 1 });

    let stepCounter = 0;
    const tx = {
      detailSOP: {
        create: jest.fn().mockResolvedValue({ detailSopId: 'detail-2' }),
      },
      lampiranPeringatan: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      lampiranKualifikasiPelaksanaan: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      lampiranPeralatanPerlengkapan: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      lampiranPencatatanPendataan: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      dasarHukum: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      detailSOPPelaksana: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      sopTerkait: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      langkahSOP: {
        create: jest.fn().mockImplementation(async () => {
          stepCounter += 1;
          return { langkahSopId: `step-new-${stepCounter}` };
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      konfigurasiDiagramSOP: { create: jest.fn().mockResolvedValue(undefined) },
      overridePanahDiagramSOP: { create: jest.fn().mockResolvedValue(undefined) },
      titikTekukPanahDiagramSOP: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      overrideLabelDiagramSOP: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      sOP: { update: jest.fn().mockResolvedValue(undefined) },
      logEditSOP: { create: jest.fn().mockResolvedValue(undefined) },
    };
    prisma.$transaction.mockImplementation(async (callback: (arg: any) => Promise<any>) => callback(tx));

    const result = await repository.cloneDetailSopFromSource({
      sourceDetailSopId: 'detail-1',
      userId: 'user-1',
    });

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ detailSopId: 'detail-2', versi: 2 });
    expect(tx.detailSOP.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sopId: 'sop-1',
        versi: 2,
        namaLembaga: 'Biro Organisasi',
        dibuatOlehId: 'user-1',
        terakhirDieditOlehId: 'user-1',
        revisiDariDetailSopId: 'detail-1',
      }),
    });
    expect(tx.dasarHukum.createMany).toHaveBeenCalledWith({
      data: [{ detailSopId: 'detail-2', peraturanId: 'peraturan-1' }],
    });
    expect(tx.detailSOPPelaksana.createMany).toHaveBeenCalledWith({
      data: [{ detailSopId: 'detail-2', pelaksanaId: 'pelaksana-1', urutan: 1 }],
    });
    expect(tx.langkahSOP.create).toHaveBeenCalledTimes(2);
    expect(tx.langkahSOP.update).toHaveBeenCalledWith({
      where: { langkahSopId: 'step-new-1' },
      data: { langkahSelanjutnyaYaId: 'step-new-2', langkahSelanjutnyaTidakId: null },
    });
    expect(tx.konfigurasiDiagramSOP.create).toHaveBeenCalledWith({
      data: { detailSopId: 'detail-2', jenis: JenisDiagram.FLOWCHART, layoutSeed: 9 },
    });
    expect(tx.overridePanahDiagramSOP.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        detailSopId: 'detail-2',
        dariLangkahSopId: 'step-new-1',
        keLangkahSopId: 'step-new-2',
      }),
    });
    expect(tx.overrideLabelDiagramSOP.createMany).toHaveBeenCalledWith({
      data: [
        {
          detailSopId: 'detail-2',
          jenis: JenisDiagram.FLOWCHART,
          kunciLabel: 'edge-1',
          posisiX: 11,
          posisiY: 12,
        },
      ],
    });
    expect(tx.sOP.update).toHaveBeenCalledWith({
      where: { sopId: 'sop-1' },
      data: { status: StatusSOP.DRAFT },
    });
  });
});
