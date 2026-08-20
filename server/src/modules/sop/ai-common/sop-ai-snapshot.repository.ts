import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { SopAiSnapshotContext } from './sop-ai-snapshot.types';

@Injectable()
export class SopAiSnapshotRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findContext(detailSopId: string): Promise<SopAiSnapshotContext | null> {
    const row = await this.prisma.detailSOP.findUnique({
      where: { detailSopId },
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

    if (row === null) return null;

    const targetOrderById = new Map(
      row.langkahSOP.map((step) => [step.langkahSopId, step.urutan] as const),
    );

    return {
      ownerId: row.sop.workspace.ownerId,
      status: row.sop.status,
      snapshot: {
        detailSopId: row.detailSopId,
        versi: row.versi,
        judul: row.sop.judul,
        nomorSop: row.nomorSOP,
        namaLembaga: row.namaLembaga,
        peringatan: row.lampiranPeringatan.map((item) => item.teks),
        kualifikasiPelaksanaan: row.lampiranKualifikasiPelaksanaan.map((item) => item.teks),
        peralatanPerlengkapan: row.lampiranPeralatanPerlengkapan.map((item) => item.teks),
        pencatatanPendataan: row.lampiranPencatatanPendataan.map((item) => item.teks),
        actors: row.swimlanes.map((lane) => ({
          pelaksanaId: lane.pelaksanaId,
          name: lane.pelaksana.nama,
          order: lane.urutan,
        })),
        steps: row.langkahSOP.map((step) => ({
          langkahSopId: step.langkahSopId,
          urutan: step.urutan,
          kegiatan: step.kegiatan,
          jenis: step.jenis,
          kelengkapan: step.kelengkapan,
          keluaran: step.keluaran,
          waktu: step.waktu,
          satuanWaktu: step.satuanWaktu,
          keterangan: step.keterangan,
          actorName: step.pelaksana.nama,
          targetYaUrutan:
            step.langkahSelanjutnyaYaId === null
              ? null
              : (targetOrderById.get(step.langkahSelanjutnyaYaId) ?? null),
          targetTidakUrutan:
            step.langkahSelanjutnyaTidakId === null
              ? null
              : (targetOrderById.get(step.langkahSelanjutnyaTidakId) ?? null),
        })),
      },
    };
  }
}
