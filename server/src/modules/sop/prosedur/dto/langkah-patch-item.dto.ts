import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { JenisLangkahProsedur, SatuanWaktu } from '../../../../generated/prisma';

/**
 * Satu langkah prosedur. `tempId` adalah ID stabil di seluruh body PATCH (cukup
 * unik di muatan data tsb) untuk merujuk relasi cabang Ya/Tidak antar entri.
 */
export class LangkahPatchItem {
  @ApiProperty({
    description:
      'ID stabil di muatan data (boleh UUID langkahSopId yang ada atau dibuat klien). Dipakai untuk relasi cabang antar item.',
  })
  @IsString()
  @MaxLength(255)
  readonly tempId!: string;

  @ApiProperty({ enum: JenisLangkahProsedur })
  @IsEnum(JenisLangkahProsedur)
  readonly jenis!: JenisLangkahProsedur;

  @ApiProperty({ description: 'Deskripsi kegiatan / nama langkah' })
  @IsString()
  @MaxLength(2000)
  readonly kegiatan!: string;

  @ApiPropertyOptional({ description: 'Mutu baku — kelengkapan' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly kelengkapan?: string;

  @ApiPropertyOptional({ description: 'Mutu baku — keluaran' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly keluaran?: string;

  @ApiPropertyOptional({ description: 'Mutu baku — waktu (angka, tanpa satuan)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly waktu?: number;

  @ApiPropertyOptional({ enum: SatuanWaktu })
  @IsOptional()
  @IsEnum(SatuanWaktu)
  readonly satuanWaktu?: SatuanWaktu;

  @ApiPropertyOptional({ description: 'Keterangan tambahan' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly keterangan?: string;

  @ApiPropertyOptional({
    description:
      'ID master Pelaksana yang menjalankan langkah ini. Harus muncul di `pelaksana[]` muatan data (atau di jalur pelaksana yang ada bila pelaksana tidak diset).',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  readonly pelaksanaId?: string;

  @ApiPropertyOptional({
    description: 'tempId entri lain (cabang Ya). Hanya berlaku untuk jenis KEPUTUSAN.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  readonly langkahSelanjutnyaYaTempId?: string | null;

  @ApiPropertyOptional({
    description: 'tempId entri lain (cabang Tidak). Hanya berlaku untuk jenis KEPUTUSAN.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  readonly langkahSelanjutnyaTidakTempId?: string | null;
}
