import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Satu baris daftar SOP di panel kiri workspace evaluasi. */
export class EvaluasiWorkspaceDaftarSopRowDto {
  @ApiProperty({
    format: 'uuid',
    description: 'ID DetailSOP versi terbaru dalam pipeline evaluasi',
  })
  readonly detailSopId!: string;

  @ApiProperty({ format: 'uuid' })
  readonly sopId!: string;

  @ApiProperty()
  readonly judul!: string;

  @ApiProperty()
  readonly nomorSOP!: string;

  @ApiProperty({ description: 'Status DetailSOP terbaru (enum StatusSOP)' })
  readonly statusDetail!: string;

  @ApiProperty()
  readonly statusDetailLabel!: string;

  @ApiProperty()
  readonly hasilEvaluasi!: string;

  @ApiProperty()
  readonly hasilEvaluasiLabel!: string;

  @ApiProperty({
    enum: ['perlu_evaluasi', 'sedang_dievaluasi', 'selesai_pengajuan_ini'],
    description: 'Normalisasi alur untuk badge/filter UI',
  })
  readonly tampilanAlur!: 'perlu_evaluasi' | 'sedang_dievaluasi' | 'selesai_pengajuan_ini';

  @ApiProperty()
  readonly tampilanAlurLabel!: string;

  @ApiPropertyOptional({ enum: ['TERBUKA', 'SELESAI'], nullable: true })
  readonly statusTindakLanjut?: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly statusTindakLanjutLabel?: string | null;

  @ApiProperty({ description: 'Versi DetailSOP saat ini' })
  readonly versi!: number;

  @ApiProperty({ format: 'date-time', description: 'Waktu terakhir dokumen diubah' })
  readonly detailUpdatedAt!: string;

  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'Waktu penyusun menandai tindak lanjut umpan balik selesai',
  })
  readonly ditindaklanjutiPada!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Evaluator terakhir yang mengisi nilai untuk dokumen ini (opsional)',
    type: 'object',
    properties: { nama: { type: 'string' }, pada: { type: 'string', format: 'date-time' } },
  })
  readonly evaluatorTerakhir!: { nama: string; pada: string } | null;
}
