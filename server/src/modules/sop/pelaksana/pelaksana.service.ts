import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import { Prisma } from '../../../generated/prisma';
import { WorkspaceService } from '../../workspace/workspace.service';
import type { CreatePelaksanaDto } from './dto/create-pelaksana.dto';
import type { PelaksanaResponseDto } from './dto/pelaksana-response.dto';
import type { UpdatePelaksanaDto } from './dto/update-pelaksana.dto';
import { PelaksanaRepository, type PelaksanaRow } from './pelaksana.repository';

@Injectable()
export class PelaksanaService {
  constructor(
    private readonly pelaksanaRepository: PelaksanaRepository,
    private readonly workspaceService: WorkspaceService,
  ) {}

  private mapRow(row: PelaksanaRow): PelaksanaResponseDto {
    return {
      id: row.pelaksanaId,
      workspaceId: row.workspaceId,
      namaPelaksana: row.nama,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(user: JwtAccessPayload, workspaceId: string): Promise<PelaksanaResponseDto[]> {
    await this.workspaceService.assertOwner(user.sub, workspaceId);
    const rows = await this.pelaksanaRepository.findManyByWorkspaceId(workspaceId);
    return rows.map((row) => this.mapRow(row));
  }

  async create(user: JwtAccessPayload, dto: CreatePelaksanaDto): Promise<PelaksanaResponseDto> {
    await this.workspaceService.assertOwner(user.sub, dto.workspaceId);
    try {
      return this.mapRow(
        await this.pelaksanaRepository.create(dto.workspaceId, dto.namaPelaksana.trim()),
      );
    } catch (err) {
      this.rethrowUniqueNameConflict(err);
      throw err;
    }
  }

  async update(
    user: JwtAccessPayload,
    id: string,
    dto: UpdatePelaksanaDto,
  ): Promise<PelaksanaResponseDto> {
    const existing = await this.findOwned(user, id);
    try {
      return this.mapRow(
        await this.pelaksanaRepository.updateNama(existing.pelaksanaId, dto.namaPelaksana.trim()),
      );
    } catch (err) {
      this.rethrowUniqueNameConflict(err);
      throw err;
    }
  }

  async remove(user: JwtAccessPayload, id: string): Promise<void> {
    await this.findOwned(user, id);
    const langkah = await this.pelaksanaRepository.countLangkahReferences(id);
    const swim = await this.pelaksanaRepository.countSwimlaneReferences(id);
    if (langkah > 0 || swim > 0) {
      throw new ConflictException(
        'Pelaksana masih direferensikan pada langkah atau jalur pelaksana SOP',
      );
    }
    await this.pelaksanaRepository.delete(id);
  }

  private async findOwned(user: JwtAccessPayload, id: string): Promise<PelaksanaRow> {
    const workspaceCandidates = await this.workspaceService.list(user.sub);
    for (const workspace of workspaceCandidates) {
      const row = await this.pelaksanaRepository.findByIdAndWorkspace(id, workspace.workspaceId);
      if (row !== null) return row;
    }
    throw new NotFoundException('Pelaksana tidak ditemukan');
  }

  private rethrowUniqueNameConflict(err: unknown): void {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictException('Pelaksana dengan nama tersebut sudah ada di workspace ini');
    }
  }
}
