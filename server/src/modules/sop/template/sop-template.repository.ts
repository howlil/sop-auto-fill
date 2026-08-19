import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { SopTemplateDbRow, WorkspaceActorRow } from './sop-template.types';

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
}
