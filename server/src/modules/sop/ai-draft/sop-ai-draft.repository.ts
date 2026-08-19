import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export type AiDraftWorkspaceActorRow = {
  pelaksanaId: string;
  nama: string;
};

@Injectable()
export class SopAiDraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  findWorkspaceActors(workspaceId: string): Promise<AiDraftWorkspaceActorRow[]> {
    return this.prisma.pelaksana.findMany({
      where: { workspaceId },
      select: { pelaksanaId: true, nama: true },
      orderBy: { nama: 'asc' },
    });
  }
}
