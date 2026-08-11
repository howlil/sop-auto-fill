import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class TtePengesahanPublicPenandatanganDto {
  @ApiProperty({ description: 'Nama penandatangan' })
  nama!: string;

  @ApiProperty({ description: 'NIP penandatangan' })
  nip!: string;

  @ApiProperty({ description: 'Jabatan (boleh kosong)' })
  jabatan!: string;
}

class TtePengesahanPublicDokumenDto {
  @ApiProperty()
  dokumenTteId!: string;

  @ApiProperty()
  nomorDokumen!: string;

  @ApiProperty()
  judulDokumen!: string;

  @ApiProperty({ description: 'Nilai enum JenisDokumenTte' })
  jenisDokumen!: string;

  @ApiProperty({ description: 'Hash SHA-256 kanonik dokumen' })
  hashDokumen!: string;

  @ApiPropertyOptional({ nullable: true })
  sopDetailId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  pengajuanEvaluasiId?: string | null;
}

/** Respons GET publik `/tte/public/pengesahan/:dokumenTteId/:userId` (verifikasi scan QR). */
export class TtePengesahanPublicResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Pengguna penandatangan (bagian PK junction)' })
  userId!: string;

  @ApiProperty({ format: 'uuid', description: 'Dokumen TTE (bagian PK junction)' })
  dokumenTteId!: string;

  @ApiProperty({ description: 'Waktu pengesahan (ISO 8601)' })
  ditandatanganiPada!: string;

  @ApiProperty({ enum: ['KEPALA_OPD', 'PJ_EVALUATOR', 'PJ_PENYUSUN'] })
  peran!: 'KEPALA_OPD' | 'PJ_EVALUATOR' | 'PJ_PENYUSUN';

  @ApiProperty({ type: TtePengesahanPublicPenandatanganDto })
  penandatangan!: TtePengesahanPublicPenandatanganDto;

  @ApiProperty({ type: TtePengesahanPublicDokumenDto })
  dokumen!: TtePengesahanPublicDokumenDto;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'URL verifikasi publik bila origin aplikasi dapat ditentukan (request atau PUBLIC_APP_ORIGIN)',
  })
  qrVerificationUrl!: string | null;

  @ApiProperty({ description: 'String yang di-encode ke QR (URL atau JSON)' })
  qrPayload!: string;
}
