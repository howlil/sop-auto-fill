import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BagianSOP, StatusSOP } from '../../../generated/prisma';
import { appendOrCreateLogSession } from '../collaboration/log-edit-session.helper';
import { normalizeActorName } from './sop-template.mapper';
import type {
  SopTemplateCreateIdentity,
  SopTemplateDbRow,
  ValidatedTemplate,
  WorkspaceActorRow,
} from './sop-template.types';

@Injectable()
export class SopTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  listActiveTemplates(): Promise<SopTemplateDbRow[]> {
    return this.prisma.sopTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { steps: { orderBy: { urutan: 'asc' } } },
    });
  }

  findActiveTemplateById(templateId: string): Promise<SopTemplateDbRow | null> {
    return this.prisma.sopTemplate.findFirst({
      where: { templateId, isActive: true },
      include: { steps: { orderBy: { urutan: 'asc' } } },
    });
  }

  findWorkspaceActors(workspaceId: string): Promise<WorkspaceActorRow[]> {
    return this.prisma.pelaksana.findMany({
      where: { workspaceId },
      select: { pelaksanaId: true, nama: true },
      orderBy: { nama: 'asc' },
    });
  }

  instantiateTemplate(params: {
    template: ValidatedTemplate;
    workspaceId: string;
    userId: string;
    judul: string;
    nomorSop: string;
    namaLembaga: string;
  }): Promise<SopTemplateCreateIdentity> {
    return this.prisma.$transaction(async (tx) => {
      const sop = await tx.sOP.create({
        data: {
          workspaceId: params.workspaceId,
          judul: params.judul,
          status: StatusSOP.DRAFT,
        },
        select: { sopId: true },
      });
      const detail = await tx.detailSOP.create({
        data: {
          sopId: sop.sopId,
          versi: 1,
          nomorSOP: params.nomorSop,
          namaLembaga: params.namaLembaga,
          dibuatOlehId: params.userId,
          terakhirDieditOlehId: params.userId,
        },
        select: { detailSopId: true },
      });

      const existingActors = await tx.pelaksana.findMany({
        where: { workspaceId: params.workspaceId },
        select: { pelaksanaId: true, nama: true },
      });
      const actorByKey = new Map(
        existingActors.map((actor) => [normalizeActorName(actor.nama), actor] as const),
      );

      for (const actorName of params.template.actorNames) {
        const key = normalizeActorName(actorName);
        if (actorByKey.has(key)) continue;
        const actor = await tx.pelaksana.upsert({
          where: {
            workspaceId_nama: { workspaceId: params.workspaceId, nama: actorName },
          },
          update: {},
          create: { workspaceId: params.workspaceId, nama: actorName },
          select: { pelaksanaId: true, nama: true },
        });
        actorByKey.set(key, actor);
      }

      await tx.detailSOPPelaksana.createMany({
        data: params.template.actorNames.map((actorName, index) => ({
          detailSopId: detail.detailSopId,
          pelaksanaId: actorByKey.get(normalizeActorName(actorName))!.pelaksanaId,
          urutan: index,
        })),
      });

      if (params.template.peringatan.length > 0) {
        await tx.lampiranPeringatan.createMany({
          data: params.template.peringatan.map((teks) => ({
            detailSopId: detail.detailSopId,
            teks,
          })),
        });
      }
      if (params.template.kualifikasiPelaksanaan.length > 0) {
        await tx.lampiranKualifikasiPelaksanaan.createMany({
          data: params.template.kualifikasiPelaksanaan.map((teks) => ({
            detailSopId: detail.detailSopId,
            teks,
          })),
        });
      }
      if (params.template.peralatanPerlengkapan.length > 0) {
        await tx.lampiranPeralatanPerlengkapan.createMany({
          data: params.template.peralatanPerlengkapan.map((teks) => ({
            detailSopId: detail.detailSopId,
            teks,
          })),
        });
      }
      if (params.template.pencatatanPendataan.length > 0) {
        await tx.lampiranPencatatanPendataan.createMany({
          data: params.template.pencatatanPendataan.map((teks) => ({
            detailSopId: detail.detailSopId,
            teks,
          })),
        });
      }

      const stepIdByOrder = new Map<number, string>();
      for (const step of params.template.steps) {
        const actor = actorByKey.get(normalizeActorName(step.actorName));
        if (!actor) throw new Error('Template actor resolution failed');
        const created = await tx.langkahSOP.create({
          data: {
            detailSopId: detail.detailSopId,
            urutan: step.urutan,
            kegiatan: step.kegiatan,
            jenis: step.jenis,
            kelengkapan: step.kelengkapan,
            keluaran: step.keluaran,
            waktu: step.waktu,
            satuanWaktu: step.satuanWaktu,
            keterangan: step.keterangan,
            pelaksanaId: actor.pelaksanaId,
          },
          select: { langkahSopId: true },
        });
        stepIdByOrder.set(step.urutan, created.langkahSopId);
      }

      for (const step of params.template.steps) {
        if (step.targetYaUrutan === null && step.targetTidakUrutan === null) continue;
        await tx.langkahSOP.update({
          where: { langkahSopId: stepIdByOrder.get(step.urutan)! },
          data: {
            langkahSelanjutnyaYaId:
              step.targetYaUrutan === null ? null : stepIdByOrder.get(step.targetYaUrutan)!,
            langkahSelanjutnyaTidakId:
              step.targetTidakUrutan === null ? null : stepIdByOrder.get(step.targetTidakUrutan)!,
          },
        });
      }

      await appendOrCreateLogSession({
        tx,
        detailSopId: detail.detailSopId,
        penggunaId: params.userId,
        bagian: BagianSOP.HEADER,
        fields: ['create', 'pelaksana', 'langkah'],
        discrete: true,
      });

      return {
        sopId: sop.sopId,
        detailSopId: detail.detailSopId,
        workspaceId: params.workspaceId,
        status: StatusSOP.DRAFT,
      };
    });
  }
}
