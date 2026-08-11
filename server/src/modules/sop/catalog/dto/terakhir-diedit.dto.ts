import { ApiPropertyOptional } from '@nestjs/swagger';

/** Ringkasan penyunting terakhir pada versi DetailSOP yang ditampilkan. */
export class TerakhirDieditDto {
  @ApiPropertyOptional({
    description: 'Nama pengguna terakhir mengubah detail SOP',
    nullable: true,
  })
  readonly nama!: string | null;

  @ApiPropertyOptional({ description: 'Waktu pembaruan detail SOP (ISO 8601)', nullable: true })
  readonly waktu!: string | null;
}
