import { ApiProperty } from '@nestjs/swagger';

/** Satu baris daftar Kepala OPD untuk manajemen Biro Organisasi. */
export class KepalaOpdPublicDto {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty()
  readonly nama!: string;

  @ApiProperty()
  readonly nip!: string;

  @ApiProperty()
  readonly email!: string;

  @ApiProperty()
  readonly nohp!: string;

  @ApiProperty()
  readonly jabatan!: string;

  @ApiProperty()
  readonly pangkat!: string;

  @ApiProperty({ format: 'uuid' })
  readonly opdId!: string;

  @ApiProperty()
  readonly namaOpd!: string;

  @ApiProperty({ description: 'deletedAt === null' })
  readonly isActive!: boolean;

  @ApiProperty()
  readonly updatedAt!: Date;

  @ApiProperty({
    description: 'True jika akun boleh dihapus (belum ada Detail SOP yang dibuat pengguna ini)',
  })
  readonly dapatDihapus!: boolean;
}
