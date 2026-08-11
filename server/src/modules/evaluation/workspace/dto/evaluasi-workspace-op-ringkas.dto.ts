import { ApiProperty } from '@nestjs/swagger';

/** OPD ringkas di workspace evaluasi. */
export class EvaluasiWorkspaceOpRingkasDto {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty()
  readonly nama!: string;
}
