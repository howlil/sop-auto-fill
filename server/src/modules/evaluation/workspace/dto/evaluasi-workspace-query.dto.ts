import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** Query GET workspace evaluasi per OPD (muat bertahap + batas riwayat). */
export class EvaluasiWorkspaceQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'DetailSOP terpilih (panel kanan / riwayat nilai; wajib untuk expand preview)',
  })
  @IsOptional()
  @IsUUID()
  readonly detailSopId?: string;

  @ApiPropertyOptional({
    description:
      'Gunakan `preview` untuk menyertakan muatan data area kerja ringkas (butuh detailSopId)',
    example: 'preview',
  })
  @IsOptional()
  @IsString()
  readonly expand?: string;

  @ApiPropertyOptional({
    default: 30,
    minimum: 1,
    maximum: 50,
    description: 'Jumlah maksimum entri riwayat OPD dan riwayat nilai SOP terpilih',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  readonly riwayatLimit?: number;
}
