import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TolakPengajuanEvaluasiDto {
  @ApiProperty({
    description: 'Alasan resmi penolakan yang akan diteruskan sebagai catatan ke seluruh SOP.',
    maxLength: 2000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  readonly alasan!: string;

  @ApiProperty({ description: 'Versi pengajuan untuk optimistic locking.', minimum: 0 })
  @IsInt()
  @Min(0)
  readonly version!: number;
}
