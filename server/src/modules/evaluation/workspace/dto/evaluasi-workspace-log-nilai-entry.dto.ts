import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Entri log penilaian untuk DetailSOP terpilih di workspace evaluator. */
export class EvaluasiWorkspaceLogNilaiEntryDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty()
  readonly sopDetailId!: string;

  @ApiProperty()
  readonly evaluatorId!: string;

  @ApiProperty()
  readonly evaluatorNama!: string;

  @ApiPropertyOptional()
  readonly hasilSebelum?: string;

  @ApiPropertyOptional()
  readonly hasilSesudah?: string;

  @ApiPropertyOptional()
  readonly catatanSebelum?: string;

  @ApiPropertyOptional()
  readonly catatanSesudah?: string;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: string;
}
