import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Input pembuatan SOP + DetailSOP versi 1 (opdId dan dibuatOlehId di-set server dari JWT). */
export class CreateSopDto {
  @ApiProperty({ description: 'Judul SOP (header)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(500)
  readonly judul!: string;

  @ApiProperty({ description: 'Nomor SOP pada versi pertama DetailSOP (unik global)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  readonly nomorSop!: string;

  @ApiPropertyOptional({
    description:
      'Nama lembaga pada dokumen (multi-baris boleh). Jika tidak dikirim atau kosong, disimpan string kosong (bukan nama OPD).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly namaLembaga?: string;
}
