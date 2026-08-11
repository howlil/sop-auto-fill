import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SopRiwayatVersiRowDto {
  @ApiProperty({ format: 'uuid' })
  readonly detailSopId!: string;

  @ApiProperty()
  readonly versi!: number;

  @ApiProperty()
  readonly nomorSOP!: string;

  @ApiProperty()
  readonly status!: string;

  @ApiProperty()
  readonly statusLabel!: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  readonly revisiDariDetailSopId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly revisiDariVersi!: number | null;

  @ApiProperty()
  readonly updatedAt!: string;

  @ApiProperty({ description: 'Boleh dihapus (DRAFT revisi tanpa nilai evaluasi)' })
  readonly canHapusDraft!: boolean;

  @ApiProperty({
    description: 'Versi ini dapat dijadikan sumber versi baru pada kondisi SOP saat ini',
  })
  readonly canBuatVersiBaru!: boolean;
}
