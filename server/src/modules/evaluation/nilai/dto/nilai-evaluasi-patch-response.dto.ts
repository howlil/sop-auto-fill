import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HasilEvaluasi, StatusTindakLanjut } from '../../../../generated/prisma';

/** Respons mutasi nilai — selaras field yang dipakai klien (`sopDetailId`). */
export class NilaiEvaluasiPatchResponseDto {
  @ApiProperty({
    description:
      'Identifier stabil gabungan `pengajuanEvaluasiId:detailSopId` (bukan UUID kolom surrogate).',
  })
  readonly id!: string;

  @ApiProperty({ format: 'uuid' })
  readonly pengajuanEvaluasiId!: string;

  @ApiProperty({ format: 'uuid' })
  readonly sopDetailId!: string;

  @ApiPropertyOptional({ enum: HasilEvaluasi })
  readonly hasil?: HasilEvaluasi;

  @ApiPropertyOptional({ nullable: true })
  readonly catatan?: string | null;

  @ApiPropertyOptional({ enum: StatusTindakLanjut, nullable: true })
  readonly statusTindakLanjut?: StatusTindakLanjut | null;

  @ApiPropertyOptional({ nullable: true })
  readonly statusTindakLanjutLabel?: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly ditindaklanjutiPada?: string | null;

  @ApiProperty()
  readonly version!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  readonly dinilaiOlehId?: string | null;

  @ApiProperty()
  readonly createdAt!: string;

  @ApiProperty()
  readonly updatedAt!: string;
}
