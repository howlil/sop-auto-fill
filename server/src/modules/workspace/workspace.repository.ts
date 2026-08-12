import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Workspace } from '../../generated/prisma';

@Injectable()
export class WorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOwner(ownerId: string): Promise<Workspace[]> {
    return this.prisma.workspace.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findOwnedById(ownerId: string, workspaceId: string): Promise<Workspace | null> {
    return this.prisma.workspace.findFirst({
      where: { workspaceId, ownerId },
    });
  }

  create(ownerId: string, name: string): Promise<Workspace> {
    return this.prisma.workspace.create({ data: { ownerId, name } });
  }

  updateName(workspaceId: string, name: string): Promise<Workspace> {
    return this.prisma.workspace.update({
      where: { workspaceId },
      data: { name },
    });
  }

  async remove(workspaceId: string): Promise<void> {
    await this.prisma.workspace.delete({ where: { workspaceId } });
  }
}
