import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PengajuanArsipQueryDto } from '../../pengajuan/dto/pengajuan-arsip-query.dto';

/** Query GET `/evaluasi/pengajuan/:id/sop-dokumen/:detailSopId`. */
export class PengajuanSopDokumenQueryDto extends PengajuanArsipQueryDto {
  @ApiPropertyOptional({
    default: 100,
    minimum: 1,
    maximum: 500,
    description: 'Batas entri logEdit area kerja (sejajar GET area kerja penyusun)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  readonly logsLimit?: number;
}
