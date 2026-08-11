import { ApiProperty } from '@nestjs/swagger';

/** Satu entri OPD tempat Kepala OPD pernah / sedang bertugas (tabel RiwayatOpdPengguna). */
export class KepalaOpdRiwayatItemDto {
  @ApiProperty({ format: 'uuid' })
  readonly opdId!: string;

  @ApiProperty()
  readonly namaOpd!: string;

  @ApiProperty()
  readonly dicatatPada!: Date;

  @ApiProperty()
  readonly diperbaruiPada!: Date;

  @ApiProperty({ description: 'True jika OPD ini sama dengan penempatan utama pengguna saat ini' })
  readonly isAktif!: boolean;
}
