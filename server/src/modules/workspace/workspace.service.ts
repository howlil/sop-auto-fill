import { Injectable, NotFoundException } from '@nestjs/common';
import type { Workspace } from '../../generated/prisma';
import { WorkspaceRepository } from './workspace.repository';

@Injectable()
export class WorkspaceService {
  constructor(private readonly repository: WorkspaceRepository) {}

  list(ownerId: string): Promise<Workspace[]> {
    return this.repository.listByOwner(ownerId);
  }

  create(ownerId: string, name: string): Promise<Workspace> {
    return this.repository.create(ownerId, name.trim());
  }

  async getOwned(ownerId: string, workspaceId: string): Promise<Workspace> {
    const workspace = await this.repository.findOwnedById(ownerId, workspaceId);
    if (workspace === null) {
      throw new NotFoundException('Workspace tidak ditemukan');
    }
    return workspace;
  }

  async rename(ownerId: string, workspaceId: string, name: string): Promise<Workspace> {
    await this.getOwned(ownerId, workspaceId);
    return this.repository.updateName(workspaceId, name.trim());
  }

  async remove(ownerId: string, workspaceId: string): Promise<void> {
    await this.getOwned(ownerId, workspaceId);
    await this.repository.remove(workspaceId);
  }

  async assertOwner(ownerId: string, workspaceId: string): Promise<void> {
    await this.getOwned(ownerId, workspaceId);
  }
}
