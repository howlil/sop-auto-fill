import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** OPD ringkas pada shell pengajuan. */
export class PengajuanShellOpdDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty()
  readonly nama!: string;
}

/** Satu baris SOP dalam pengajuan evaluasi (panel kiri; tanpa isi dokumen). */
export class PengajuanSopItemShellDto {
  @ApiProperty({ format: 'uuid' })
  readonly detailSopId!: string;

  @ApiProperty({ format: 'uuid' })
  readonly sopId!: string;

  @ApiProperty()
  readonly judul!: string;

  @ApiProperty()
  readonly nomorSOP!: string;

  @ApiProperty()
  readonly statusDetailSop!: string;

  @ApiProperty()
  readonly statusDetailSopLabel!: string;

  @ApiProperty()
  readonly hasilEvaluasi!: string;

  @ApiProperty()
  readonly hasilEvaluasiLabel!: string;

  @ApiPropertyOptional()
  readonly catatanRingkas?: string;

  @ApiPropertyOptional({ type: () => Object })
  readonly evaluatorTerakhir?: { id: string; nama: string };
}

/** Satu entri nilai evaluasi (selaras kebutuhan klien mutasi & ringkasan). */
export class PengajuanNilaiEvaluasiShellDto {
  @ApiProperty({
    description:
      'Identifier stabil gabungan `pengajuanEvaluasiId:detailSopId` (bukan UUID baris DB).',
  })
  readonly id!: string;

  @ApiProperty()
  readonly pengajuanEvaluasiId!: string;

  @ApiProperty()
  readonly sopDetailId!: string;

  @ApiPropertyOptional()
  readonly hasil?: string;

  @ApiPropertyOptional()
  readonly catatan?: string;

  @ApiPropertyOptional({ enum: ['TERBUKA', 'SELESAI'] })
  readonly statusTindakLanjut?: string;

  @ApiPropertyOptional()
  readonly statusTindakLanjutLabel?: string;

  @ApiPropertyOptional()
  readonly ditindaklanjutiPada?: string;

  @ApiProperty()
  readonly version!: number;

  @ApiPropertyOptional()
  readonly dinilaiOlehId?: string;

  @ApiPropertyOptional({ type: () => Object })
  readonly dinilaiOleh?: { id: string; nama: string };

  @ApiPropertyOptional({ type: () => Object })
  readonly sopDetail?: { id: string };

  @ApiProperty()
  readonly createdAt!: string;

  @ApiProperty()
  readonly updatedAt!: string;
}

/** Entri timeline perubahan nilai (log). */
export class PengajuanTimelineNilaiDto {
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

  @ApiProperty()
  readonly createdAt!: string;
}

/** Ringkasan GET `/evaluasi/pengajuan/:id` — tanpa langkah/alur kerja teks besar. */
export class PengajuanEvaluasiShellDto {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Tidak dikirim untuk PJ Penyusun (konteks OPD implisit).',
  })
  readonly opdId?: string;

  @ApiPropertyOptional({
    description: 'Tidak dikirim untuk PJ Penyusun (konteks OPD implisit).',
  })
  readonly opdNama?: string;

  @ApiProperty()
  readonly jenis!: string;

  @ApiProperty()
  readonly status!: string;

  @ApiProperty()
  readonly statusLabel!: string;

  @ApiProperty()
  readonly version!: number;

  @ApiPropertyOptional()
  readonly nomorBA?: string;

  @ApiPropertyOptional()
  readonly tanggalPermintaan?: string;

  @ApiPropertyOptional()
  readonly tanggalEvaluasi?: string;

  @ApiPropertyOptional({ description: 'Terisi bila status ditandatangani PJ Evaluator' })
  readonly tanggalVerifikasi?: string;

  @ApiPropertyOptional({
    description: 'Tidak dikirim untuk PJ Penyusun (konteks OPD implisit).',
  })
  readonly nilaiOPD?: number;

  @ApiPropertyOptional()
  readonly diverifikasiOlehUserId?: string;

  @ApiPropertyOptional()
  readonly namaPjEvaluator?: string;

  @ApiPropertyOptional()
  readonly ditandatanganiOlehPjPenyusunUserId?: string;

  @ApiPropertyOptional()
  readonly namaPjPenyusun?: string;

  @ApiPropertyOptional()
  readonly tanggalTTDBaPjPenyusun?: string;

  @ApiPropertyOptional()
  readonly diselesaikanOlehId?: string;

  @ApiPropertyOptional({ type: () => Object })
  readonly diselesaikanOleh?: { id: string; nama: string };

  @ApiPropertyOptional({
    type: () => PengajuanShellOpdDto,
    description: 'Tidak dikirim untuk PJ Penyusun (konteks OPD implisit).',
  })
  readonly opd?: PengajuanShellOpdDto;

  @ApiPropertyOptional()
  readonly timEvaluasi?: string;

  @ApiPropertyOptional()
  readonly tanggalDiselesaikan?: string;

  @ApiPropertyOptional()
  readonly alasanPenolakan?: string;

  @ApiPropertyOptional()
  readonly tanggalDitolak?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  readonly ditolakOlehId?: string;

  @ApiPropertyOptional({ type: () => Object })
  readonly ditolakOleh?: { id: string; nama: string };

  @ApiProperty({ type: () => [PengajuanSopItemShellDto] })
  readonly sopItems!: PengajuanSopItemShellDto[];

  @ApiProperty({ type: () => [PengajuanNilaiEvaluasiShellDto] })
  readonly nilaiEvaluasi!: PengajuanNilaiEvaluasiShellDto[];

  @ApiProperty({ type: () => [PengajuanTimelineNilaiDto] })
  readonly timelineNilai!: PengajuanTimelineNilaiDto[];

  @ApiProperty()
  readonly createdAt!: string;

  @ApiProperty()
  readonly updatedAt!: string;
}
