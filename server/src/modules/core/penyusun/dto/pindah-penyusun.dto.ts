import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Body PATCH pindah penyusun ke OPD lain. */
export class PindahPenyusunDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly opdId!: string;
}
