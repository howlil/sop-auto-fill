import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { HasilEvaluasi } from '../../../../generated/prisma';

/** Body PATCH `/evaluasi/:pengajuanEvaluasiId/nilai/:detailSopId`. */
export class IsiNilaiEvaluasiDto {
  @ApiProperty({ enum: [HasilEvaluasi.SESUAI, HasilEvaluasi.PERLU_PERBAIKAN] })
  @IsIn([HasilEvaluasi.SESUAI, HasilEvaluasi.PERLU_PERBAIKAN])
  readonly hasil!: HasilEvaluasi;

  @ApiPropertyOptional({ description: 'Wajib berisi teks jika hasil PERLU_PERBAIKAN' })
  @IsOptional()
  @IsString()
  @MaxLength(65_000)
  readonly catatan?: string;

  @ApiPropertyOptional({ description: 'Optimistic locking NilaiEvaluasi.version', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly version?: number;
}
