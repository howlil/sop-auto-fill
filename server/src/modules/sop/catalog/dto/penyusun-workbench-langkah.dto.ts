import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Satu langkah prosedur (selaras klien LangkahSOP). */
export class PenyusunWorkbenchLangkahDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty()
  readonly sopDetailId!: string;

  @ApiProperty()
  readonly urutan!: number;

  @ApiProperty()
  readonly kegiatan!: string;

  @ApiProperty()
  readonly jenis!: string;

  @ApiProperty()
  readonly kelengkapan!: string;

  @ApiProperty()
  readonly keluaran!: string;

  @ApiProperty()
  readonly waktu!: number;

  @ApiProperty()
  readonly satuanWaktu!: string;

  @ApiProperty()
  readonly keterangan!: string;

  @ApiProperty()
  readonly pelaksanaId!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly langkahSelanjutnyaYaId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly langkahSelanjutnyaTidakId?: string | null;

  @ApiProperty()
  readonly createdAt!: string;

  @ApiProperty()
  readonly updatedAt!: string;

  @ApiPropertyOptional()
  readonly pelaksana?: { id: string; namaPelaksana: string };
}
