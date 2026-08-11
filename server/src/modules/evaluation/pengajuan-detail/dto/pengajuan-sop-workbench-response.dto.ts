import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PenyusunWorkbenchDataDto } from '../../../sop/catalog/dto/penyusun-workbench-data.dto';
import { BeritaAcaraTteSignaturePayloadDto } from './berita-acara-evaluasi-view.dto';

/** Respons GET `/evaluasi/pengajuan/:pengajuanId/sop-dokumen/:detailSopId`. */
export class PengajuanSopWorkbenchResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly detailSopId!: string;

  @ApiProperty({ type: () => PenyusunWorkbenchDataDto })
  readonly workbench!: PenyusunWorkbenchDataDto;

  @ApiPropertyOptional({
    type: () => BeritaAcaraTteSignaturePayloadDto,
    description: 'Muatan data QR TTE Kepala OPD bila SOP sudah ditandatangani',
  })
  readonly tteSignaturePayloadKepalaOpd?: BeritaAcaraTteSignaturePayloadDto;
}
