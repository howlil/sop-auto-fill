import { ApiProperty } from '@nestjs/swagger';
import { PeranPengguna } from '../../../../generated/prisma';

/** Potongan data pengguna untuk respons evaluator Biro. */
export class EvaluatorUserPublicDto {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty()
  readonly nama!: string;

  @ApiProperty()
  readonly email!: string;

  @ApiProperty()
  readonly nip!: string;

  @ApiProperty()
  readonly jabatan!: string;

  @ApiProperty()
  readonly pangkat!: string;

  @ApiProperty()
  readonly nohp!: string;

  @ApiProperty({ enum: PeranPengguna })
  readonly peran!: PeranPengguna;
}
