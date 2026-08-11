import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertDetailSopEditable } from '../../../common/status/sop-editable.util';
import type { JwtAccessPayload } from '../../../common';
import { PeranPengguna, StatusSOP } from '../../../generated/prisma';
import { UserOpdAccessService } from '../../core/opd/user-opd-access.service';
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
    private readonly userOpdAccessService: UserOpdAccessService,
  ) {}

  async updateDiagram(
    user: JwtAccessPayload,
    detailOrSopId: string,
    dto: UpdateSopDiagramDto,
    logsLimit?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    const resolved = await this.sopDiagramRepository.findDetailIdByDetailOrSopId(detailOrSopId);
    if (resolved === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    await this.assertPenyusunOpdAccess(user, resolved.sopOpdId);
    const detailStatus = await this.sopDiagramRepository.findDetailStatus(resolved.detailSopId);
    if (detailStatus === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    assertDetailSopEditable(detailStatus as StatusSOP);
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

  private async assertPenyusunOpdAccess(user: JwtAccessPayload, sopOpdId: string): Promise<void> {
    if (user.peran !== PeranPengguna.PENYUSUN && user.peran !== PeranPengguna.PJ_PENYUSUN) {
      throw new ForbiddenException('Akses ditolak: hanya penyusun yang dapat mengubah diagram');
    }
    await this.userOpdAccessService.assertSameOpd(
      user.sub,
      sopOpdId,
      'Akses ditolak untuk DetailSOP ini',
    );
  }
}
