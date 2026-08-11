import { ApiProperty } from '@nestjs/swagger';

/** Satu OPD pada arsip publik SOP. */
export class PublicOpdItemDto {
  @ApiProperty({ format: 'uuid' })
  readonly opdId!: string;

  @ApiProperty()
  readonly nama!: string;

  @ApiProperty({ description: 'Jumlah header SOP yang memiliki versi BERLAKU' })
  readonly jumlahSopBerlaku!: number;
}
