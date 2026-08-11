import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluatorUserPublicDto } from './evaluator-user-public.dto';

/** Satu baris anggota evaluator (OPD Biro) untuk API. */
export class AnggotaEvaluatorItemDto {
  @ApiProperty({ format: 'uuid', description: 'Sama dengan penggunaId' })
  readonly id!: string;

  @ApiProperty({ format: 'uuid' })
  readonly userId!: string;

  @ApiProperty({ enum: ['AKTIF', 'NONAKTIF'] })
  readonly status!: 'AKTIF' | 'NONAKTIF';

  @ApiProperty({ type: String, format: 'date-time' })
  readonly tanggalBergabung!: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  readonly berakhirPada?: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly updatedAt!: Date;

  @ApiProperty({ type: EvaluatorUserPublicDto })
  readonly user!: EvaluatorUserPublicDto;
}
