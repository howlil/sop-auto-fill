import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Satu baris ringkasan hasil per SOP pada BA. */
export class BeritaAcaraHasilPerSopDto {
  @ApiProperty()
  readonly nomorSOP!: string;

  @ApiProperty()
  readonly judul!: string;

  @ApiProperty()
  readonly hasilEvaluasi!: string;

  @ApiProperty()
  readonly hasilEvaluasiLabel!: string;

  @ApiPropertyOptional()
  readonly ringkasanCatatanEvaluator?: string;
}

/** Ringkasan tim / penanggung jawab selesai evaluasi. */
export class BeritaAcaraTimEvaluasiDto {
  @ApiPropertyOptional({ type: () => Object })
  readonly penanggungJawabSelesai?: { id: string; nama: string };

  @ApiProperty({
    type: [String],
    description: 'Nama evaluator unik (dari baris nilai / dinilaiOleh)',
  })
  readonly evaluatorNamaUnik!: string[];
}

/** Metadata dokumen TTE BA (tanpa blob tanda tangan). */
export class BeritaAcaraTteSignaturePayloadDto {
  @ApiProperty({ description: 'ID stabil turunan `dokumenTteId:userId` (kompatibilitas klien)' })
  readonly id!: string;
  @ApiProperty({ format: 'uuid' })
  readonly dokumenTteId!: string;
  @ApiProperty({ format: 'uuid' })
  readonly userId!: string;
  @ApiProperty()
  readonly nip!: string;
  @ApiProperty()
  readonly namaLengkap!: string;
  @ApiPropertyOptional()
  readonly jabatan?: string;
  @ApiPropertyOptional()
  readonly signedAt?: string;
}

export class BeritaAcaraTteMetaDto {
  @ApiProperty({ format: 'uuid' })
  readonly dokumenTteId!: string;

  @ApiProperty()
  readonly hashDokumen!: string;

  @ApiProperty()
  readonly versiDokumen!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'boolean' },
    description: 'Map peran → sudah ada riwayat tanda tangan untuk dokumen ini',
  })
  readonly adaRiwayatTandaTanganPerPeran!: Record<string, boolean>;

  @ApiPropertyOptional({ type: () => BeritaAcaraTteSignaturePayloadDto })
  readonly payloadPjEvaluator?: BeritaAcaraTteSignaturePayloadDto;

  @ApiPropertyOptional({ type: () => BeritaAcaraTteSignaturePayloadDto })
  readonly payloadPjPenyusun?: BeritaAcaraTteSignaturePayloadDto;
}

/** Read-model GET `/evaluasi/pengajuan/:id/berita-acara`. */
export class BeritaAcaraEvaluasiViewDto {
  @ApiProperty()
  readonly namaOpd!: string;

  @ApiPropertyOptional()
  readonly nomorBA?: string;

  @ApiPropertyOptional()
  readonly tanggalEvaluasi?: string;

  @ApiPropertyOptional({
    description: 'Setelah ditandatangani PJ Evaluator; untuk tempat-tanggal di BA',
  })
  readonly tanggalVerifikasiPjEvaluator?: string;

  @ApiPropertyOptional()
  readonly nilaiKeseluruhanOpd?: number;

  @ApiProperty({ type: () => [BeritaAcaraHasilPerSopDto] })
  readonly hasilPerSop!: BeritaAcaraHasilPerSopDto[];

  @ApiProperty({ type: () => BeritaAcaraTimEvaluasiDto })
  readonly timEvaluasi!: BeritaAcaraTimEvaluasiDto;

  @ApiPropertyOptional({ type: () => BeritaAcaraTteMetaDto })
  readonly tteBeritaAcara?: BeritaAcaraTteMetaDto;
}
