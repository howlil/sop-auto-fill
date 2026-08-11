import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Satu SOP berlaku pada arsip publik per OPD. */
export class PublicSopItemDto {
  @ApiProperty({ format: 'uuid' })
  readonly detailSopId!: string;

  @ApiProperty({ format: 'uuid' })
  readonly sopId!: string;

  @ApiProperty({ format: 'uuid' })
  readonly opdId!: string;

  @ApiProperty()
  readonly judul!: string;

  @ApiProperty()
  readonly nomorSOP!: string;

  @ApiProperty()
  readonly versi!: number;

  @ApiPropertyOptional({ nullable: true, description: 'Tanggal efektif pengesahan (ISO 8601)' })
  readonly tanggalEfektif!: string | null;

  @ApiProperty()
  readonly opdNama!: string;

  @ApiProperty({ description: 'URL PDF resmi yang divalidasi server setiap request' })
  readonly pdfUrl!: string;
}
