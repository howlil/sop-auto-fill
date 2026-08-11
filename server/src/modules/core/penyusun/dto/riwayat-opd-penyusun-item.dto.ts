import { ApiProperty } from '@nestjs/swagger';

/** Satu baris riwayat penempatan penyusun per OPD (dari tabel RiwayatOpdPengguna). */
export class RiwayatOpdPenyusunItemDto {
  @ApiProperty({ format: 'uuid' })
  readonly opdId!: string;

  @ApiProperty({ description: 'Nama OPD' })
  readonly namaOpd!: string;

  @ApiProperty({ description: 'Pertama kali tercatat di OPD ini' })
  readonly pertamaDicatat!: Date;

  @ApiProperty({ description: 'Terakhir diperbarui (mis. setelah pindah mutasi)' })
  readonly terakhirDiperbarui!: Date;

  @ApiProperty({ description: 'True jika OPD ini sama dengan penempatan utama pengguna saat ini' })
  readonly isAktif!: boolean;
}
