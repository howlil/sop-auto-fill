import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PenyusunWorkbenchSopHeaderDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty({ format: 'uuid' })
  readonly workspaceId!: string;

  @ApiProperty()
  readonly judul!: string;

  @ApiProperty()
  readonly createdAt!: string;

  @ApiProperty()
  readonly updatedAt!: string;
}

export class PenyusunWorkbenchDetailDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty()
  readonly sopId!: string;

  @ApiProperty()
  readonly status!: string;

  @ApiProperty()
  readonly statusLabel!: string;

  @ApiProperty()
  readonly versi!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  readonly revisiDariDetailSopId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly revisiDariVersi?: number | null;

  @ApiProperty()
  readonly nomorSOP!: string;

  @ApiProperty()
  readonly tanggalPembuatan!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly tanggalRevisi?: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly tanggalEfektif?: string | null;

  @ApiProperty()
  readonly logoInstansi!: string;

  @ApiProperty()
  readonly namaLembaga!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly dibuatOlehId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly terakhirDieditOlehId?: string | null;

  @ApiProperty()
  readonly createdAt!: string;

  @ApiProperty()
  readonly updatedAt!: string;

  @ApiPropertyOptional({ type: () => PenyusunWorkbenchSopHeaderDto })
  readonly sop?: PenyusunWorkbenchSopHeaderDto;

  @ApiPropertyOptional()
  readonly dibuatOleh?: { id: string; nama: string };

  @ApiPropertyOptional()
  readonly terakhirDieditOleh?: { id: string; nama: string };

  @ApiPropertyOptional({ type: 'object', additionalProperties: false })
  readonly lampiran?: {
    peringatan: Array<{ id: string; teks: string; createdAt: string }>;
    kualifikasiPelaksanaan: Array<{ id: string; teks: string; createdAt: string }>;
    peralatanPerlengkapan: Array<{ id: string; teks: string; createdAt: string }>;
    pencatatanPendataan: Array<{ id: string; teks: string; createdAt: string }>;
  };

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  readonly dasarHukum?: unknown[];

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  readonly relasiSopKeluar?: unknown[];

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  readonly relasiSopMasuk?: unknown[];

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  readonly swimlanes?: unknown[];

  @ApiPropertyOptional({ type: [String] })
  readonly dasarHukumPeraturanIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  readonly sopTerkaitDetailIds?: string[];
}
