import { ApiProperty } from '@nestjs/swagger';

/** OPD ringkas untuk daftar dan detail baca (GET). */
export class OpdRingkasResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty()
  readonly nama!: string;
}
