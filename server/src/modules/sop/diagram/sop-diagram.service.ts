import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { assertDetailSopEditable } from '../../../common/status/sop-editable.util';
import type { JwtAccessPayload } from '../../../common';
import { SopCatalogService } from '../catalog/sop-catalog.service';
import type { PenyusunWorkbenchDataDto } from '../catalog/dto/penyusun-workbench-data.dto';
import type { UpdateSopDiagramDto } from './dto/diagram-path-overrides.dto';
import { hasInvalidDiagramEdgeKeys, isValidDiagramPathOverrides } from './diagram-edge-key.util';
import { SopDiagramRepository } from './sop-diagram.repository';

@Injectable()
export class SopDiagramService {
  constructor(
    private readonly sopDiagramRepository: SopDiagramRepository,
    private readonly sopCatalogService: SopCatalogService,
  ) {}

  async updateDiagram(
    user: JwtAccessPayload,
    detailOrSopId: string,
    dto: UpdateSopDiagramDto,
    logsLimit?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    const resolved = await this.sopDiagramRepository.findDetailIdByDetailOrSopId(detailOrSopId);
    if (resolved === null || resolved.ownerId !== user.sub) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    assertDetailSopEditable(resolved.status);

    if (dto.pathOverrides !== undefined && !isValidDiagramPathOverrides(dto.pathOverrides)) {
      throw new BadRequestException('Struktur pathOverrides tidak valid');
    }
    if (hasInvalidDiagramEdgeKeys(dto.pathOverrides)) {
      throw new BadRequestException('Kunci edge pathOverrides tidak valid');
    }

    const hasChange = dto.layoutSeed !== undefined || dto.pathOverrides !== undefined;
    if (!hasChange) {
      return this.sopCatalogService.getPenyusunWorkbench(user, resolved.detailSopId, logsLimit);
    }

    await this.sopDiagramRepository.upsertConfig({
      detailSopId: resolved.detailSopId,
      jenis: dto.jenis,
      layoutSeed: dto.layoutSeed,
      pathOverrides: dto.pathOverrides,
    });
    return this.sopCatalogService.getPenyusunWorkbench(user, resolved.detailSopId, logsLimit);
  }
}
