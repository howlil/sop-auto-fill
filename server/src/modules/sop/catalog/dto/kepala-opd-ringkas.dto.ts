import { ApiProperty } from '@nestjs/swagger';

/** Kepala OPD: pengguna aktif `peran = KEPALA_OPD` pada OPD yang sama (nama + NIP untuk blok disahkan dokumen SOP). */
export class KepalaOpdRingkasDto {
  @ApiProperty({ nullable: true, description: 'Nama lengkap Kepala OPD' })
  readonly nama!: string | null;

  @ApiProperty({ nullable: true, description: 'NIP Kepala OPD' })
  readonly nip!: string | null;
}
