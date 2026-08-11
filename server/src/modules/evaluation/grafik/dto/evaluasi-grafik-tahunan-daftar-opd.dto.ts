import { ApiProperty } from '@nestjs/swagger';

/** Satu OPD aktif (master) untuk dasar cakupan grafik. */
export class EvaluasiGrafikTahunanDaftarOpdDto {
  @ApiProperty({ format: 'uuid' })
  readonly opdId!: string;

  @ApiProperty()
  readonly opdNama!: string;
}
