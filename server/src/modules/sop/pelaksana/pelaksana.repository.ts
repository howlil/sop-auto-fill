import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export type PelaksanaRow = {
  pelaksanaId: string;
  workspaceId: string;
  nama: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PelaksanaRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByWorkspaceId(workspaceId: string): Promise<PelaksanaRow[]> {
    return this.prisma.pelaksana.findMany({
      where: { workspaceId },
      orderBy: { nama: 'asc' },
    });
  }

  findByIdAndWorkspace(pelaksanaId: string, workspaceId: string): Promise<PelaksanaRow | null> {
    return this.prisma.pelaksana.findFirst({
      where: { pelaksanaId, workspaceId },
    });
  }

  create(workspaceId: string, nama: string): Promise<PelaksanaRow> {
    return this.prisma.pelaksana.create({ data: { workspaceId, nama } });
  }

  updateNama(pelaksanaId: string, nama: string): Promise<PelaksanaRow> {
    return this.prisma.pelaksana.update({
      where: { pelaksanaId },
      data: { nama },
    });
  }

  async delete(pelaksanaId: string): Promise<void> {
    await this.prisma.pelaksana.delete({ where: { pelaksanaId } });
  }

  countLangkahReferences(pelaksanaId: string): Promise<number> {
    return this.prisma.langkahSOP.count({ where: { pelaksanaId } });
  }

  countSwimlaneReferences(pelaksanaId: string): Promise<number> {
    return this.prisma.detailSOPPelaksana.count({ where: { pelaksanaId } });
  }
}
