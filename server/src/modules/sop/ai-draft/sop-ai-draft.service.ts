import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtAccessPayload } from '../../../common';
import { Prisma } from '../../../generated/prisma';
import { WorkspaceService } from '../../workspace/workspace.service';
import { SopDraftInstantiationService } from '../draft/sop-draft-instantiation.service';
import { normalizeActorName } from '../draft/sop-draft-normalization';
import type { SopDraftDefinition } from '../draft/sop-draft.types';
import type { CreateAiDraftDto } from './dto/create-ai-draft.dto';
import type { GenerateAiDraftDto } from './dto/generate-ai-draft.dto';
import { AI_DRAFT_PROVIDER, type AiDraftProvider } from './providers/ai-draft-provider';
import { SopAiDraftRepository } from './sop-ai-draft.repository';
import { parseAndCanonicalizeAiDraft } from './sop-ai-draft.schema';
import type { AiDraftProposal, CanonicalAiDraftContent } from './sop-ai-draft.types';

@Injectable()
export class SopAiDraftService {
  constructor(
    private readonly repository: SopAiDraftRepository,
    private readonly workspaceService: WorkspaceService,
    @Inject(AI_DRAFT_PROVIDER) private readonly provider: AiDraftProvider,
    private readonly draftInstantiation: SopDraftInstantiationService,
    private readonly config: ConfigService,
  ) {}

  availability(): { enabled: boolean } {
    return { enabled: this.providerMode() !== 'disabled' };
  }

  async generate(
    user: JwtAccessPayload,
    dto: GenerateAiDraftDto,
  ): Promise<{ proposal: AiDraftProposal }> {
    if (this.providerMode() === 'disabled') {
      throw new ServiceUnavailableException('AI drafting belum tersedia');
    }

    await this.workspaceService.assertOwner(user.sub, dto.workspaceId);
    const workspaceActors = await this.repository.findWorkspaceActors(dto.workspaceId);
    const raw = await this.provider.generate({
      deskripsiProses: dto.deskripsiProses,
      ...(dto.tujuanProses ? { tujuanProses: dto.tujuanProses } : {}),
      ...(dto.catatanTambahan ? { catatanTambahan: dto.catatanTambahan } : {}),
      workspaceActorNames: workspaceActors.slice(0, 50).map((actor) => actor.nama),
    });
    const canonical = parseAndCanonicalizeAiDraft(raw);

    return {
      proposal: this.classifyActors(canonical, workspaceActors),
    };
  }

  async create(user: JwtAccessPayload, dto: CreateAiDraftDto) {
    await this.workspaceService.assertOwner(user.sub, dto.workspaceId);
    const canonical = parseAndCanonicalizeAiDraft(dto.proposal);

    try {
      return await this.draftInstantiation.instantiate({
        definition: this.toDraftDefinition(canonical),
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

  private providerMode(): string {
    return this.config.get<string>('AI_DRAFT_PROVIDER') ?? 'disabled';
  }

  private classifyActors(
    canonical: CanonicalAiDraftContent,
    workspaceActors: Array<{ pelaksanaId: string; nama: string }>,
  ): AiDraftProposal {
    const actorByKey = new Map(
      workspaceActors.map((actor) => [normalizeActorName(actor.nama), actor] as const),
    );
    const actorsToReuse: AiDraftProposal['actorsToReuse'] = [];
    const actorsToCreate: string[] = [];

    for (const actorName of canonical.actors) {
      const existing = actorByKey.get(normalizeActorName(actorName));
      if (existing) actorsToReuse.push({ name: actorName, pelaksanaId: existing.pelaksanaId });
      else actorsToCreate.push(actorName);
    }

    return {
      ...canonical,
      actorsToReuse,
      actorsToCreate,
    };
  }

  private toDraftDefinition(canonical: CanonicalAiDraftContent): SopDraftDefinition {
    return {
      peringatan: canonical.peringatan,
      kualifikasiPelaksanaan: canonical.kualifikasiPelaksanaan,
      peralatanPerlengkapan: canonical.peralatanPerlengkapan,
      pencatatanPendataan: canonical.pencatatanPendataan,
      actorNames: canonical.actors,
      steps: canonical.steps,
    };
  }
}
