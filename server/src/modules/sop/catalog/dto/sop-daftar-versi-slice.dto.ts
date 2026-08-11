import { ApiProperty } from '@nestjs/swagger';

/** Ringkasan satu versi DetailSOP pada daftar SOP. */
export class SopDaftarVersiSliceDto {
  @ApiProperty({ format: 'uuid' })
  readonly detailSopId!: string;

  @ApiProperty()
  readonly versi!: number;

  @ApiProperty()
  readonly nomorSop!: string;

  @ApiProperty()
  readonly status!: string;

  @ApiProperty()
  readonly statusLabel!: string;
}
