import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Satu entri riwayat evaluasi tingkat OPD (pengajuan selesai). */
export class EvaluasiWorkspaceRiwayatOpdEntryDto {
  @ApiProperty({ format: 'date-time' })
  readonly tanggal!: string;

  @ApiProperty()
  readonly evaluatorNama!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly nilaiOPD!: number | null;

  @ApiProperty({ format: 'uuid' })
  readonly pengajuanEvaluasiId!: string;
}
