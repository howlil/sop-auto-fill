import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import { Prisma } from '../../../generated/prisma';
import { WorkspaceService } from '../../workspace/workspace.service';
import type { CreateSopFromTemplateDto } from './dto/create-sop-from-template.dto';
import { normalizeActorName, summarizeTemplate, validateTemplate } from './sop-template.mapper';
import { SopTemplateRepository } from './sop-template.repository';
import type {
  SopTemplateCreateIdentity,
  SopTemplatePreview,
  SopTemplateSummary,
} from './sop-template.types';

@Injectable()
export class SopTemplateService {
  constructor(
    private readonly repository: SopTemplateRepository,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async list(): Promise<SopTemplateSummary[]> {
    const rows = await this.repository.listActiveTemplates();
    return rows.map((row) => summarizeTemplate(validateTemplate(row)));
  }

  async preview(
    user: JwtAccessPayload,
    templateId: string,
    workspaceId: string,
  ): Promise<SopTemplatePreview> {
    await this.workspaceService.assertOwner(user.sub, workspaceId);
    const template = await this.getTemplate(templateId);
    const actors = await this.repository.findWorkspaceActors(workspaceId);
    const actorsByKey = new Map(
      actors.map((actor) => [normalizeActorName(actor.nama), actor] as const),
    );
    const actorsToReuse: SopTemplatePreview['actorsToReuse'] = [];
    const actorsToCreate: string[] = [];

    for (const actorName of template.actorNames) {
      const existing = actorsByKey.get(normalizeActorName(actorName));
      if (existing) actorsToReuse.push({ name: actorName, pelaksanaId: existing.pelaksanaId });
      else actorsToCreate.push(actorName);
    }

    const lampiranDefaults: SopTemplatePreview['lampiranDefaults'] = {};
    if (template.peringatan.length > 0) lampiranDefaults.peringatan = template.peringatan;
    if (template.kualifikasiPelaksanaan.length > 0) {
      lampiranDefaults.kualifikasiPelaksanaan = template.kualifikasiPelaksanaan;
    }
    if (template.peralatanPerlengkapan.length > 0) {
      lampiranDefaults.peralatanPerlengkapan = template.peralatanPerlengkapan;
    }
    if (template.pencatatanPendataan.length > 0) {
      lampiranDefaults.pencatatanPendataan = template.pencatatanPendataan;
    }

    return {
      template: summarizeTemplate(template),
      actorsToReuse,
      actorsToCreate,
      stepCount: template.steps.length,
      lampiranDefaults,
    };
  }

  async create(
    user: JwtAccessPayload,
    templateId: string,
    dto: CreateSopFromTemplateDto,
  ): Promise<SopTemplateCreateIdentity> {
    await this.workspaceService.assertOwner(user.sub, dto.workspaceId);
    const template = await this.getTemplate(templateId);
    try {
      return await this.repository.instantiateTemplate({
        template,
        workspaceId: dto.workspaceId,
        userId: user.sub,
        judul: dto.judul.trim(),
        nomorSop: dto.nomorSop.trim(),
        namaLembaga: dto.namaLembaga.trim(),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Nomor SOP sudah digunakan');
      }
      throw error;
    }
  }

  private async getTemplate(templateId: string) {
    const row = await this.repository.findActiveTemplateById(templateId);
    if (!row) throw new NotFoundException('Template SOP tidak ditemukan');
    return validateTemplate(row);
  }
}
