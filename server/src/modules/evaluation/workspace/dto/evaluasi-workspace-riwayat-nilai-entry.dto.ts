import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Satu entri riwayat nilai untuk DetailSOP terpilih (pengajuan selesai). */
export class EvaluasiWorkspaceRiwayatNilaiEntryDto {
  @ApiProperty({ format: 'date-time' })
  readonly tanggal!: string;

  @ApiProperty()
  readonly evaluatorNama!: string;

  @ApiProperty({ enum: ['SESUAI', 'PERLU_PERBAIKAN'] })
  readonly hasil!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly catatan!: string | null;

  @ApiProperty({ format: 'uuid' })
  readonly pengajuanEvaluasiId!: string;
}
